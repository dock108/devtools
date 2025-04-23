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