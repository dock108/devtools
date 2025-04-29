import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index'; // Import context from main rules file
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase'; // Import generated types

/**
 * RULE: Velocity Breach
 * Detects if an account receives more than N payouts within a T-second window.
 */
export const velocityBreach = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // This rule only applies to payout events
  if (!event.type.startsWith('payout.') || !event.account) {
    return [];
  }

  const accountId = event.account;
  // Safely access config with defaults
  const config = ctx.config?.velocityBreach ?? {};
  const maxPayouts = typeof config.maxPayouts === 'number' ? config.maxPayouts : 3; // Default 3
  const windowSeconds = typeof config.windowSeconds === 'number' ? config.windowSeconds : 3600; // Default 1 hour

  // Calculate time window
  const cutoffTime = Date.now() - windowSeconds * 1000;

  // Filter recent payouts (using event_buffer type for now)
  // TODO: Adapt if context provides parsed payout objects instead of raw buffer entries
  const recentPayoutEvents = ctx.recentPayouts.filter((p: Tables<'event_buffer'>) => {
    // Assuming created_at exists and is valid timestamp string or Date
    return (
      p.received_at &&
      new Date(p.received_at).getTime() >= cutoffTime &&
      p.type?.startsWith('payout.')
    );
  });

  const recentCount = recentPayoutEvents.length;

  logger.info(
    { accountId, count: recentCount, max: maxPayouts, window: windowSeconds },
    'Velocity rule executed',
  );

  if (recentCount >= maxPayouts) {
    // Extract payout ID from the current triggering event
    let payoutId: string | undefined;
    if (event.data.object && typeof event.data.object === 'object' && 'id' in event.data.object) {
      // Basic check for payout structure
      if (typeof event.data.object.id === 'string') {
        payoutId = event.data.object.id;
      }
    }

    return [
      {
        alertType: AlertType.Velocity,
        severity: Severity.High,
        message: `🚨 ${recentCount} payouts detected within ${windowSeconds} seconds (threshold: ${maxPayouts}).`,
        accountId: accountId,
        payoutId: payoutId,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
};
