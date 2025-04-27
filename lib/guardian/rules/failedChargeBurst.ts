import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index';
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase';

/**
 * RULE: Failed Charge Burst
 * Detects a spike in failed charges within a defined time window.
 */
export const failedChargeBurst = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // This rule only applies to charge.failed events
  if (event.type !== 'charge.failed' || !event.account) {
    return [];
  }

  const accountId = event.account;
  const charge = event.data.object as Stripe.Charge; // Assert type

  // Safely access config with defaults
  const config = ctx.config?.failedChargeBurst ?? {};
  const minFailedCount = typeof config.minFailedCount === 'number' ? config.minFailedCount : 3; // Default 3
  const windowMinutes = typeof config.windowMinutes === 'number' ? config.windowMinutes : 5; // Default 5 mins

  // Calculate time window
  const cutoffTime = Date.now() - windowMinutes * 60 * 1000;

  // Filter recent failed charges (using event_buffer type for now)
  // TODO: Adapt if context provides parsed charge objects
  const recentFailedChargeEvents = ctx.recentCharges.filter((c: Tables<'event_buffer'>) => {
    return (
      c.type === 'charge.failed' && c.received_at && new Date(c.received_at).getTime() >= cutoffTime
    );
  });

  const recentCount = recentFailedChargeEvents.length;

  logger.info(
    {
      accountId,
      chargeId: charge.id,
      count: recentCount,
      threshold: minFailedCount,
      window: windowMinutes,
    },
    'Failed charge burst rule executed',
  );

  // Trigger alert if threshold exceeded
  if (recentCount >= minFailedCount) {
    return [
      {
        alertType: AlertType.FailedChargeBurst,
        severity: Severity.High,
        message: `High rate of failed payments: ${recentCount} failed charge(s) detected in the last ${windowMinutes} minutes (threshold: ${minFailedCount}).`,
        // Include chargeId or other relevant details if needed
        // payoutId: undefined, // Not directly related to a payout
      },
    ];
  }

  return [];
};
