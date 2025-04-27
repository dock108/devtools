import { log } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json, Tables } from '@/types/supabase';
import { AlertType, Severity, GuardianRuleOutput } from '@/lib/guardian/constants';
import { validateStripeEvent } from '@/lib/guardian/validateStripeEvent';
 
import Stripe from 'https://esm.sh/stripe@12.17.0?target=deno&deno-std=0.132.0';

// Define the context structure expected by Edge rules
interface EdgeRuleContext {
  config: Record<string, any>;
}

// Type for Edge-compatible rule functions
type EdgeRuleFunction = (
  event: Stripe.Event,
  ctx: EdgeRuleContext,
) => Promise<GuardianRuleOutput[]>;

// Individual rule functions adapted for Edge (minimal DB access)

async function velocityBreachRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if (!event.type.startsWith('payout.') || !event.account) return [];

  const accountId = event.account;
  const config = ctx.config?.velocityBreach ?? {};
  const maxPayouts = typeof config.maxPayouts === 'number' ? config.maxPayouts : 3;
  const windowSeconds = typeof config.windowSeconds === 'number' ? config.windowSeconds : 3600;

  // Logic requires recent payout data - this cannot be easily fetched *within* the Edge rule itself.
  // This data MUST be fetched *before* calling evaluateRulesEdge and passed in the context.
  // Placeholder - assumes context contains necessary pre-fetched data.
  const recentPayoutCount = (ctx as any).recentPayoutCount ?? 0; // Example: Assuming count is passed in context

  log.debug(
    {
      accountId,
      count: recentPayoutCount,
      max: maxPayouts,
      window: windowSeconds,
      rule: 'velocityBreach',
    },
    'Edge Velocity rule executed',
  );

  if (recentPayoutCount >= maxPayouts) {
    let payoutId: string | undefined;
    if (
      event.data.object &&
      typeof event.data.object === 'object' &&
      'id' in event.data.object &&
      typeof event.data.object.id === 'string'
    ) {
      payoutId = event.data.object.id;
    }
    return [
      {
        alertType: AlertType.Velocity,
        severity: Severity.High,
        message: `🚨 ${recentPayoutCount} payouts detected within ${windowSeconds} seconds (threshold: ${maxPayouts}).`,
        payoutId: payoutId,
      },
    ];
  }
  return [];
}

async function bankSwapRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if ((event.type !== 'payout.created' && event.type !== 'payout.paid') || !event.account)
    return [];

  const accountId = event.account;
  const payout = event.data.object as Stripe.Payout;

  const config = ctx.config?.bankSwap ?? {};
  const minPayoutUsd = typeof config.minPayoutUsd === 'number' ? config.minPayoutUsd : 1000;
  const lookbackMinutes = typeof config.lookbackMinutes === 'number' ? config.lookbackMinutes : 30;

  const payoutAmount = payout.amount / 100;
  if (payoutAmount < minPayoutUsd) return [];

  // Logic requires recent bank change event data - must be passed in context.
  // Placeholder - assumes context contains necessary pre-fetched data.
  const recentBankChangeTimestamp = (ctx as any).recentBankChangeTimestamp; // Example: Assuming timestamp is passed
  const lookbackCutoffTime = Date.now() - lookbackMinutes * 60 * 1000;

  log.debug(
    { accountId, payoutId: payout.id, bankChangeFound: !!recentBankChangeTimestamp },
    'Edge Bank-swap rule evaluated',
  );

  if (!recentBankChangeTimestamp || recentBankChangeTimestamp < lookbackCutoffTime) {
    return [];
  }

  return [
    {
      alertType: AlertType.BankSwap,
      severity: Severity.High,
      message: `Potential bank swap: External account created ~${Math.round((Date.now() - recentBankChangeTimestamp) / 60000)} min before a $${payoutAmount.toFixed(2)} payout.`,
      payoutId: payout.id,
    },
  ];
}

// Geo-mismatch is difficult in Edge without pre-fetching charge data.
// Consider simplifying or moving this logic if pre-fetching is too complex.
async function geoMismatchRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if ((event.type !== 'payout.created' && event.type !== 'payout.paid') || !event.account)
    return [];
  // This rule likely requires fetching recent charges, which is not ideal for Edge functions.
  // Placeholder: returning empty for now, assuming this logic is handled elsewhere or pre-fetched.
  log.warn(
    { accountId: event.account, rule: 'geoMismatch' },
    'Edge Geo-mismatch rule skipped (requires pre-fetched charge data)',
  );
  return [];
}

// Failed charge burst is also difficult without pre-fetching.
async function failedChargeBurstRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if (event.type !== 'charge.failed' || !event.account) return [];
  // Requires fetching recent failed charges.
  // Placeholder: returning empty.
  log.warn(
    { accountId: event.account, rule: 'failedChargeBurst' },
    'Edge Failed charge burst rule skipped (requires pre-fetched charge data)',
  );
  return [];
}

// These rules only depend on the current event, suitable for Edge.
async function suddenPayoutDisableRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if (event.type !== 'account.updated' || !event.account) return [];

  const accountId = event.account;
  const enabled = ctx.config?.suddenPayoutDisable?.enabled ?? true;
  if (!enabled) return [];

  const account = event.data.object as Stripe.Account;
  const previousAttributes = event.data.previous_attributes as Partial<Stripe.Account> | undefined;

  if (previousAttributes?.payouts_enabled === true && account.payouts_enabled === false) {
    log.debug({ accountId, rule: 'suddenPayoutDisable' }, 'Edge Sudden payout disable detected');
    return [
      {
        alertType: AlertType.SuddenPayoutDisable,
        severity: Severity.Medium,
        message: `Payouts were disabled for account ${accountId}. Investigate the reason in your Stripe dashboard.`,
      },
    ];
  }
  return [];
}

async function highRiskReviewRule(
  event: Stripe.Event,
  ctx: EdgeRuleContext,
): Promise<GuardianRuleOutput[]> {
  if (event.type !== 'review.opened' || !event.account) return [];

  const accountId = event.account;
  const review = event.data.object as Stripe.Review;

  const enabled = ctx.config?.highRiskReview?.enabled ?? true;
  if (!enabled) return [];

  if (review.reason === 'rule') {
    let chargeId: string | undefined;
    if (typeof review.charge === 'string') chargeId = review.charge;
    else if (review.charge && typeof review.charge === 'object' && 'id' in review.charge)
      chargeId = review.charge.id;

    log.debug(
      { accountId, reviewId: review.id, chargeId, rule: 'highRiskReview' },
      'Edge High risk review detected',
    );
    return [
      {
        alertType: AlertType.HighRiskReview,
        severity: Severity.High,
        message: `Stripe flagged a potentially high-risk transaction for review (Charge: ${chargeId ?? 'N/A'}).`,
      },
    ];
  }
  return [];
}

// All Edge-compatible rules to run
const edgeRules: EdgeRuleFunction[] = [
  velocityBreachRule, // Requires context.recentPayoutCount
  bankSwapRule, // Requires context.recentBankChangeTimestamp
  // geoMismatchRule,       // Skipped - requires pre-fetched charge data
  // failedChargeBurstRule, // Skipped - requires pre-fetched charge data
  suddenPayoutDisableRule,
  highRiskReviewRule,
];

/**
 * Edge-compatible version of evaluateRules.
 * Assumes context data (like recent event counts/timestamps) is pre-fetched and passed in.
 * Avoids direct database calls within the rule functions themselves.
 *
 * @param event - The validated Stripe event object.
 * @param supabase - The Supabase client (primarily for potential future use, not direct rule DB calls).
 * @param config - The merged rule configuration for the account.
 * @param edgeContext - Additional pre-fetched data needed by Edge rules.
 * @returns A promise resolving to an array of rule outputs.
 */
export async function evaluateRulesEdge(
  event: Stripe.Event,
  supabase: SupabaseClient, // Pass client, though rules here avoid using it directly
  config: Record<string, any>,
  edgeContext: Partial<EdgeRuleContext> = {}, // Allow passing partial context
): Promise<GuardianRuleOutput[]> {
  const accountId = event.account;
  const eventId = event.id;
  const baseLogData = { eventId, accountId, service: 'evaluateRulesEdge' };

  if (!accountId) {
    log.warn({ ...baseLogData }, 'Skipping rule evaluation - no account ID');
    return [];
  }
  if (!config) {
    log.error({ ...baseLogData }, 'Skipping rule evaluation - no config provided');
    return [];
  }

  const startTime = performance.now();

  // Combine provided config and context
  const fullContext: EdgeRuleContext = {
    config: config,
    ...edgeContext, // Merge pre-fetched data
  };

  // Run each rule against the event
  const ruleOutputs: GuardianRuleOutput[] = [];
  for (const rule of edgeRules) {
    try {
      // Pass the event and the combined context
      const ruleResults = await rule(event, fullContext);
      ruleOutputs.push(...ruleResults);
    } catch (error: any) {
      // Use optional chaining for safer error message access
      log.error(
        { ...baseLogData, error: error?.message, rule: rule.name },
        'Edge rule evaluation failed',
      );
    }
  }

  const totalTime = performance.now() - startTime;
  log.info(
    { ...baseLogData, alerts: ruleOutputs.length, timeMs: Math.round(totalTime) },
    'Edge rule engine executed',
  );
  return ruleOutputs;
}
