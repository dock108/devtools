// This file contains the main rule evaluation logic for the Node.js environment.
// For the Edge environment, see ./edge.ts

// import { ruleConfig } from '../config'; // Base config, loaded via getRuleConfig now
import { velocityBreach } from './velocityBreach';
import { bankSwap } from './bankSwap';
import { geoMismatch } from './geoMismatch';
import { failedChargeBurst } from './failedChargeBurst'; // Added new rule
import { suddenPayoutDisable } from './suddenPayoutDisable'; // Added new rule
import { highRiskReview } from './highRiskReview'; // Added new rule
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
// import type { StripeEvent, Alert, RuleContext } from '../types'; // Use constants and generated types
import { evaluateRulesEdge } from './edge';
import { Database, Json, Tables, TablesInsert } from '@/types/supabase'; // Use generated types
import { GuardianRuleOutput, Severity, AlertType } from '@/lib/guardian/constants'; // Use shared types
import { getRuleConfig } from '@/lib/guardian/getRuleConfig'; // Use central config loader
import Stripe from 'stripe'; // Import official Stripe types

// Define the set of rules to evaluate in the Node.js environment
// Type the rules array for better safety
type RuleFunction = (event: Stripe.Event, context: RuleContext) => Promise<GuardianRuleOutput[]>;

const rules: RuleFunction[] = [
  velocityBreach,
  bankSwap,
  geoMismatch,
  failedChargeBurst,
  suddenPayoutDisable,
  highRiskReview,
];

// Define the context needed for Node.js rules
// This may differ slightly from Edge if DB access patterns vary
export interface RuleContext {
  config: Record<string, any>; // The merged rule configuration
  recentPayouts: Tables<'payout_events'>[]; // Example: Type for recent payouts
  recentCharges: Tables<'payout_events'>[]; // Example: Type for recent charges
  // Add other context fields as needed, e.g., Stripe.Account details
  // stripeAccount?: Stripe.Account;
}

/**
 * Evaluates all configured Guardian rules against a given Stripe event.
 * This version runs in the Node.js environment and can perform richer database queries.
 * @param event - The validated Stripe event object.
 * @param accountId - The Stripe account ID associated with the event.
 * @returns A promise that resolves to an array of generated alerts.
 */
export async function evaluateRules(
  event: Stripe.Event,
  accountId: string,
): Promise<TablesInsert<'alerts'>[]> {
  // Skip if no account ID (should not happen with prior validation)
  if (!accountId) {
    logger.warn({ event_id: event.id }, 'evaluateRules called without accountId');
    return [];
  }

  // --- 1. Fetch Configuration --- //
  let mergedConfig: Record<string, any>;
  try {
    mergedConfig = await getRuleConfig(accountId);
    if (!mergedConfig) {
      throw new Error('Failed to retrieve rule configuration (default or custom).');
    }
  } catch (error: any) {
    logger.error(
      { error: error?.message, accountId, event_id: event.id },
      'Critical error fetching rule configuration',
    );
    return []; // Cannot proceed without config
  }

  // --- 2. Fetch Context Data --- //
  // Determine lookback based on config (example)
  // TODO: Define lookback periods more granularly based on rule needs
  const maxLookbackMinutes = Math.max(
    mergedConfig.velocityBreach?.windowMinutes || 60,
    mergedConfig.bankSwap?.lookbackMinutes || 30,
    mergedConfig.failedChargeBurst?.windowMinutes || 5,
    24 * 60, // Geo-mismatch lookback (24 hours)
  );
  const lookbackDate = new Date(Date.now() - maxLookbackMinutes * 60 * 1000).toISOString();

  let contextData: RuleContext;
  try {
    const [payoutsResult, chargesResult] = await Promise.all([
      supabaseAdmin
        .from('event_buffer') // Query event_buffer for raw data needed
        .select('*')
        .eq('stripe_account_id', accountId)
        .in('type', ['payout.paid', 'payout.created', 'external_account.created']) // Events relevant to payouts/bank swaps
        .gte('received_at', lookbackDate)
        .order('received_at', { ascending: false })
        .returns<Tables<'event_buffer'>[]>(), // Use generated type
      supabaseAdmin
        .from('event_buffer')
        .select('*')
        .eq('stripe_account_id', accountId)
        .like('type', 'charge.%') // Relevant charge events
        .gte('received_at', lookbackDate)
        .order('received_at', { ascending: false })
        .returns<Tables<'event_buffer'>[]>(),
      // Add promises for other context data here (e.g., Stripe Account details)
    ]);

    if (payoutsResult.error) throw payoutsResult.error;
    if (chargesResult.error) throw chargesResult.error;

    contextData = {
      config: mergedConfig,
      // TODO: Adapt these based on actual needs - querying event_buffer might require parsing payload
      recentPayouts: payoutsResult.data ?? [],
      recentCharges: chargesResult.data ?? [],
      // stripeAccount: accountDetailsResult.data // If fetching account details
    };
  } catch (error: any) {
    logger.error(
      { error: error?.message, accountId, event_id: event.id },
      'Failed to fetch context data for rules',
    );
    return []; // Cannot proceed without context
  }

  // --- 3. Run Rules --- //
  const generatedAlerts: TablesInsert<'alerts'>[] = [];
  for (const rule of rules) {
    try {
      const ruleOutputs: GuardianRuleOutput[] = await rule(event, contextData);

      // Map rule outputs to the database alert insert format
      for (const output of ruleOutputs) {
        generatedAlerts.push({
          alert_type: output.alertType, // Already AlertType enum
          severity: output.severity, // Already Severity enum
          message: output.message,
          stripe_payout_id: output.payoutId,
          stripe_account_id: accountId,
          event_id: event.id, // Link alert to the triggering Stripe event ID
          resolved: false,
          // created_at is handled by DB default
        });
      }
    } catch (error: any) {
      logger.error(
        { error: error?.message, rule: rule.name, eventId: event.id, accountId },
        'Rule evaluation failed',
      );
      // Continue to next rule even if one fails
    }
  }

  logger.info(
    { event_id: event.id, accountId, alerts_generated: generatedAlerts.length },
    'Rule engine executed',
  );
  return generatedAlerts;
}

// Re-export the Edge-compatible version (if it still exists and is needed)
// Consider if the Edge version can be deprecated or merged if Node.js handles all now.
export { evaluateRulesEdge };
