import { ruleConfig } from '../config';
import { velocityBreach } from './velocityBreach';
import { bankSwap } from './bankSwap';
import { geoMismatch } from './geoMismatch';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import type { StripeEvent, Alert, RuleContext } from '../types';
import { evaluateRulesEdge } from './edge';

const rules = [velocityBreach, bankSwap, geoMismatch] as const;

export async function evaluateRules(event: StripeEvent): Promise<Alert[]> {
  const accountId = event.account as string;
  
  // Skip if no account ID present (rare, but possible)
  if (!accountId) {
    logger.info({ id: event.id }, 'Skipping rule evaluation - no account ID');
    return [];
  }
  
  // Calculate lookback period for events
  // Max of 1 hour or double the bank swap lookback period
  const bankSwapLookbackMs = ruleConfig.bankSwap.lookbackMinutes * 60_000 * 2;
  const lookbackMs = Math.max(3600_000, bankSwapLookbackMs);
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
      
    config: ruleConfig,
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

// Re-export the Edge-compatible version
export { evaluateRulesEdge }; 