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
  const alerts: Alert[] = [];
  
  // Only apply to payout.paid events
  if (event.type !== 'payout.paid') {
    return alerts;
  }
  
  const accountId = event.account as string;
  const { maxPayouts, windowSeconds } = ctx.config.velocityBreach;
  
  // Count recent payouts for this account
  const now = new Date().getTime();
  const cutoff = now - (windowSeconds * 1000);
  
  const recentPayouts = ctx.recentPayouts.filter(p => 
    new Date(p.created_at).getTime() >= cutoff
  );
  
  // Include current payout in the count
  const totalInWindow = recentPayouts.length + 1;
  
  if (totalInWindow > maxPayouts) {
    const payoutId = (event.data.object as any).id || '';
    alerts.push({
      type: 'VELOCITY',
      severity: 'high',
      message: `Velocity breach detected: ${totalInWindow} payouts in ${windowSeconds} seconds`,
      payoutId,
      accountId,
      createdAt: new Date().toISOString()
    });
  }
  
  return alerts;
}

async function bankSwapRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  const alerts: Alert[] = [];
  
  // Apply to account.updated with external_accounts or external_account.created events
  if (
    !(event.type === 'account.updated' && 
      event.data.previous_attributes?.external_accounts) && 
    !(event.type === 'external_account.created')
  ) {
    return alerts;
  }
  
  const accountId = event.account as string;
  
  // Get the external account ID
  let externalAccountId = 'unknown';
  if (event.type === 'external_account.created') {
    externalAccountId = (event.data.object as any).id || '';
  } else if (
    event.data.previous_attributes?.external_accounts?.data?.[0]?.id
  ) {
    externalAccountId = event.data.previous_attributes.external_accounts.data[0].id;
  }
  
  // Check for any high-value payouts within lookback window
  const { lookbackMinutes, minPayoutUsd } = ctx.config.bankSwap;
  const now = new Date().getTime();
  const lookbackMs = lookbackMinutes * 60 * 1000;
  const cutoff = now - lookbackMs;
  
  const recentPayouts = ctx.recentPayouts.filter(p => 
    new Date(p.created_at).getTime() >= cutoff && 
    (p.amount / 100) >= minPayoutUsd // Convert cents to dollars
  );
  
  // Always flag bank account changes
  alerts.push({
    type: 'BANK_SWAP',
    severity: recentPayouts.length > 0 ? 'high' : 'medium',
    message: `Bank account changed${recentPayouts.length > 0 ? ' after recent high-value payouts' : ''}`,
    accountId,
    chargeId: externalAccountId, // Using chargeId to store external account ID
    createdAt: new Date().toISOString()
  });
  
  return alerts;
}

async function geoMismatchRule(event: StripeEvent, ctx: RuleContext): Promise<Alert[]> {
  const alerts: Alert[] = [];
  
  // Only apply to payout-related events
  if (!['payout.paid', 'payout.created', 'payout.updated'].includes(event.type)) {
    return alerts;
  }
  
  const accountId = event.account as string;
  const metadata = (event.data.object as any)?.metadata || {};
  
  // Check for risk indicators in metadata
  const riskFactors = (metadata.risk_factors as string | undefined)?.split(',') || [];
  const hasGeoMismatch = riskFactors.includes('unusual_location') || 
                         riskFactors.includes('geo_mismatch') || 
                         metadata.guardian_reason === 'geo_mismatch';
  
  if (hasGeoMismatch) {
    const payoutId = (event.data.object as any).id || '';
    const { mismatchChargeCount } = ctx.config.geoMismatch;
    
    // Count charges with geo mismatches for this account
    const geoMismatchCharges = ctx.recentCharges.filter(c => {
      const chargeMeta = c.event_data?.metadata || {};
      const chargeRiskFactors = (chargeMeta.risk_factors as string | undefined)?.split(',') || [];
      return chargeRiskFactors.includes('unusual_location') || 
             chargeRiskFactors.includes('geo_mismatch');
    });
    
    // Increase severity if this is a pattern
    const severity = geoMismatchCharges.length >= mismatchChargeCount ? 'high' : 'medium';
    
    alerts.push({
      type: 'GEO_MISMATCH',
      severity,
      message: `Payout initiated from unusual location${geoMismatchCharges.length > 0 ? ' (repeated pattern)' : ''}`,
      payoutId,
      accountId,
      createdAt: new Date().toISOString()
    });
  }
  
  return alerts;
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
  
  // Fetch context data needed for all rules
  const ctx: RuleContext = {
    recentPayouts: (await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString()) // last hour
      .order('created_at', { ascending: false })).data || [],
      
    recentCharges: (await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .like('type', 'charge.%')
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
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