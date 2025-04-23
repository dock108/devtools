import type { StripeEvent, Alert, RuleContext } from '../types';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

// Hard-coded default config that matches the schema
// This avoids using Ajv at runtime in Edge functions
const defaultConfig = {
  velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
  bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
  geoMismatch: { mismatchChargeCount: 2 }
};

// Individual rule functions with inline implementations for Edge compatibility
async function velocityBreachRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  if (!event.type.startsWith('payout.')) return [];

  const accountId = event.account as string;
  const { maxPayouts, windowSeconds } = ctx.config.velocityBreach;
  
  const cutoff = Date.now() - windowSeconds * 1000;
  const recent = ctx.recentPayouts.filter(
    (p) => new Date(p.created_at).getTime() >= cutoff,
  );

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
  // Log for all events
  logger.info({ accountId: event.account }, 'Bank-swap rule evaluated');
  
  // Only inspect payout events
  if (!event.type.startsWith('payout.')) return [];

  const payout = event.data.object as any;
  const payoutUsd = payout.amount / 100;

  if (payoutUsd < ctx.config.bankSwap.minPayoutUsd) return [];

  // Find latest external_account.created in look-back window
  const cutoff = Date.now() - ctx.config.bankSwap.lookbackMinutes * 60_000;
  const recentBankChange = ctx.recentPayouts.find(
    (e) =>
      e.type === 'external_account.created' &&
      new Date(e.created_at).getTime() >= cutoff,
  );

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

  logger.info({ accountId: event.account, mismatches: mismatches.length }, 'Geo-mismatch rule executed');

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

// All rules to run
const rules = [velocityBreachRule, bankSwapRule, geoMismatchRule];

/**
 * Edge-compatible version of evaluateRules that doesn't rely on 
 * dynamic module imports or Ajv for rule evaluation
 */
export async function evaluateRulesEdge(event: StripeEvent): Promise<Alert[]> {
  const accountId = event.account as string;
  
  // Skip if no account ID present (rare, but possible)
  if (!accountId) {
    logger.info({ id: event.id }, 'Skipping rule evaluation - no account ID');
    return [];
  }
  
  // Calculate lookback period for events
  // Max of 1 hour, double the bank swap lookback period, or 24 hours for geo-mismatch
  const bankSwapLookbackMs = defaultConfig.bankSwap.lookbackMinutes * 60_000 * 2;
  const geoMismatchLookbackMs = 24 * 60 * 60 * 1000; // 24 hours
  const lookbackMs = Math.max(3600_000, bankSwapLookbackMs, geoMismatchLookbackMs);
  const lookbackDate = new Date(Date.now() - lookbackMs).toISOString();
  
  // Fetch context data needed for all rules
  const ctx: RuleContext = {
    recentPayouts: (await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .or(`type.eq.payout.paid,type.eq.payout.created,type.eq.external_account.created`)
      .gte('created_at', lookbackDate)
      .order('created_at', { ascending: false })).data || [],
      
    recentCharges: (await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .like('type', 'charge.%')
      .gte('created_at', lookbackDate)
      .order('created_at', { ascending: false })).data || [],
      
    config: defaultConfig,
  };

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
  
  logger.info({ id: event.id, alerts: alerts.length }, 'Rule engine executed');
  return alerts;
} 