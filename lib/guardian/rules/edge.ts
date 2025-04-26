import type { StripeEvent, Alert, RuleContext } from '../types';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

// Hard-coded default config that matches the schema
// This avoids using Ajv at runtime in Edge functions
const defaultConfig = {
  velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
  bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
  geoMismatch: { mismatchChargeCount: 2 },
  failedChargeBurst: { minFailedCount: 3, windowMinutes: 5 },
  suddenPayoutDisable: { enabled: true },
  highRiskReview: { enabled: true },
};

// Individual rule functions with inline implementations for Edge compatibility
async function velocityBreachRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  if (!event.type.startsWith('payout.')) return [];

  const accountId = event.account as string;
  const { maxPayouts, windowSeconds } = ctx.config.velocityBreach;

  const cutoff = Date.now() - windowSeconds * 1000;
  const recent = ctx.recentPayouts.filter((p) => new Date(p.created_at).getTime() >= cutoff);

  logger.info({ accountId, count: recent.length }, 'Velocity rule executed');

  if (recent.length >= maxPayouts) {
    return [
      {
        type: 'VELOCITY',
        severity: 'high',
        message: `🚨 ${recent.length} payouts inside ${windowSeconds}s`,
        payoutId: (event.data.object as any).id,
        accountId: event.account!,
        createdAt: new Date().toISOString(),
      },
    ];
  }
  return [];
}

async function bankSwapRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  // Only inspect payout events
  if (!event.type.startsWith('payout.')) return [];

  const payout = event.data.object as any;
  const payoutUsd = payout.amount / 100;
  const accountId = event.account as string;

  if (payoutUsd < ctx.config.bankSwap.minPayoutUsd) return [];

  // Find latest external_account.created in look-back window
  const cutoff = Date.now() - ctx.config.bankSwap.lookbackMinutes * 60_000;
  const recentBankChange = ctx.recentPayouts.find(
    (e) => e.type === 'external_account.created' && new Date(e.created_at).getTime() >= cutoff,
  );

  logger.info({ accountId, bankChangeFound: !!recentBankChange }, 'Bank-swap rule evaluated');

  if (!recentBankChange) return [];

  return [
    {
      type: 'BANK_SWAP',
      severity: 'high',
      message: `Bank account swapped ${ctx.config.bankSwap.lookbackMinutes} min before $${payoutUsd} payout`,
      payoutId: payout.id,
      accountId: event.account!,
      createdAt: new Date().toISOString(),
    },
  ];
}

async function geoMismatchRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  if (!event.type.startsWith('payout.')) return [];

  const payout = event.data.object as any;
  const bankCountry = payout.destination?.account_country || payout.currency?.slice(0, 2);

  // Collect last-day charges for this account
  const mismatches = ctx.recentCharges.filter((c) => {
    const chargeCountry = c.event_data.ip_country ?? c.event_data.billing_details?.address?.country;
    return chargeCountry && bankCountry && chargeCountry !== bankCountry;
  });

  logger.info(
    { accountId: event.account, mismatches: mismatches.length },
    'Geo-mismatch rule executed',
  );

  if (mismatches.length < ctx.config.geoMismatch.mismatchChargeCount) return [];

  return [
    {
      type: 'GEO_MISMATCH',
      severity: 'medium',
      message: `Detected ${mismatches.length} charges from foreign IPs vs bank country ${bankCountry}`,
      payoutId: payout.id,
      accountId: event.account!,
      createdAt: new Date().toISOString(),
    },
  ];
}

// New rule to detect burst of failed charges
async function failedChargeBurstRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  // Only run this rule for failed charge events
  if (!event.type.includes('failed')) return [];

  const accountId = event.account as string;
  const { minFailedCount, windowMinutes } = ctx.config.failedChargeBurst;

  // Calculate time window
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  // Filter recent failed charges within the time window
  const recentFailedCharges = ctx.recentCharges.filter(
    (charge) => charge.type.includes('failed') && new Date(charge.created_at).getTime() >= cutoff,
  );

  logger.info(
    {
      accountId,
      count: recentFailedCharges.length,
      threshold: minFailedCount,
      window: windowMinutes,
    },
    'Failed charge burst rule executed',
  );

  // Trigger alert if threshold exceeded
  if (recentFailedCharges.length >= minFailedCount) {
    return [
      {
        type: 'FAILED_CHARGE_BURST',
        severity: 'high',
        message: `Spike in failed payments for ${accountId} – ${recentFailedCharges.length} in the last ${windowMinutes} min.`,
        chargeId: (event.data.object as any).id,
        accountId: accountId,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
}

// New rule to detect when payouts are suddenly disabled
async function suddenPayoutDisableRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  // Only run this rule for account.updated events
  if (event.type !== 'account.updated') return [];

  const accountId = event.account as string;

  // Verify this rule is enabled in config
  if (!ctx.config.suddenPayoutDisable.enabled) return [];

  const accountObj = event.data.object as any;
  const previousAttributes = event.data.previous_attributes as any;

  // Check if payouts_enabled changed from true to false
  if (previousAttributes?.payouts_enabled === true && accountObj.payouts_enabled === false) {
    logger.info({ accountId }, 'Sudden payout disable detected');

    return [
      {
        type: 'SUDDEN_PAYOUT_DISABLE',
        severity: 'medium',
        message: `Payouts disabled for ${accountId}.`,
        accountId: accountId,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
}

// New rule to detect high-risk reviews
async function highRiskReviewRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  // Only run this rule for review.opened events
  if (event.type !== 'review.opened') return [];

  const accountId = event.account as string;

  // Verify this rule is enabled in config
  if (!ctx.config.highRiskReview.enabled) return [];

  const review = event.data.object as any;

  // Check if the review reason is 'rule' (Stripe's indicator for high-risk)
  if (review.reason === 'rule') {
    logger.info(
      {
        accountId,
        reviewId: review.id,
      },
      'High risk review detected',
    );

    return [
      {
        type: 'HIGH_RISK_REVIEW',
        severity: 'high',
        message: `Stripe flagged a high-risk charge on ${accountId}.`,
        chargeId: review.charge,
        accountId: accountId,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
}

// All rules to run
const rules = [
  velocityBreachRule,
  bankSwapRule,
  geoMismatchRule,
  failedChargeBurstRule,
  suddenPayoutDisableRule,
  highRiskReviewRule,
];

/**
 * Edge-compatible version of evaluateRules that doesn't rely on
 * dynamic module imports or Ajv for rule evaluation
 */
export async function evaluateRulesEdge(
  event: StripeEvent,
  supabase = supabaseAdmin,
): Promise<Alert[]> {
  const accountId = event.account as string;

  // Skip if no account ID present (rare, but possible)
  if (!accountId) {
    logger.info({ id: event.id }, 'Skipping rule evaluation - no account ID');
    return [];
  }

  const startTime = performance.now();

  // Calculate lookback period for events
  // Max of 1 hour, double the bank swap lookback period, or 24 hours for geo-mismatch
  const bankSwapLookbackMs = defaultConfig.bankSwap.lookbackMinutes * 60_000 * 2;
  const geoMismatchLookbackMs = 24 * 60 * 60 * 1000; // 24 hours
  const lookbackMs = Math.max(3600_000, bankSwapLookbackMs, geoMismatchLookbackMs);
  const lookbackDate = new Date(Date.now() - lookbackMs).toISOString();

  // Get account-specific rule set if available
  // TODO: Consider caching rule sets for frequently seen accounts
  let accountRuleSet = null;
  try {
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('rule_set')
      .eq('stripe_account_id', accountId)
      .single();

    if (account?.rule_set) {
      accountRuleSet = account.rule_set;
    }
  } catch (error) {
    logger.warn({ error, accountId }, 'Failed to retrieve account rule set');
  }

  // Merge account rule set with default config (if available)
  const mergedConfig = accountRuleSet ? { ...defaultConfig, ...accountRuleSet } : defaultConfig;

  // Fetch context data needed for all rules - optimized query with new indexes
  // This single query fetches all the data needed for the rules in parallel, eliminating N+1 patterns
  const [payoutsResponse, chargesResponse] = await Promise.all([
    // Fetch payouts and external account changes in one query
    supabase
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .or(`type.eq.payout.paid,type.eq.payout.created,type.eq.external_account.created`)
      .gte('created_at', lookbackDate)
      .order('created_at', { ascending: false }),

    // Fetch charges in another concurrent query
    supabase
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .like('type', 'charge.%')
      .gte('created_at', lookbackDate)
      .order('created_at', { ascending: false }),
  ]);

  // Create rule context from fetched data
  const ctx: RuleContext = {
    recentPayouts: payoutsResponse.data || [],
    recentCharges: chargesResponse.data || [],
    config: mergedConfig,
  };

  const fetchTime = performance.now() - startTime;
  if (fetchTime > 100) {
    // TODO: If queries consistently take more than 100ms, consider adding more specific indexes
    // or further optimizing the query patterns
    logger.warn(
      {
        accountId,
        fetchTimeMs: Math.round(fetchTime),
        payoutsCount: ctx.recentPayouts.length,
        chargesCount: ctx.recentCharges.length,
      },
      'Slow context data fetch',
    );
  }

  // Run each rule against the event
  const alerts: Alert[] = [];
  for (const rule of rules) {
    try {
      const ruleAlerts = await rule(event, ctx);
      alerts.push(...ruleAlerts);
    } catch (error) {
      logger.error({ error, rule: rule.name, eventId: event.id }, 'Rule evaluation failed');
    }
  }

  const totalTime = performance.now() - startTime;
  logger.info(
    {
      id: event.id,
      alerts: alerts.length,
      timeMs: Math.round(totalTime),
      dataFetchMs: Math.round(fetchTime),
    },
    'Rule engine executed',
  );
  return alerts;
}
