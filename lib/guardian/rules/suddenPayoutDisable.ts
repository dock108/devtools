import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index';
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';

/**
 * RULE: Sudden Payout Disable
 * Detects when an account's payouts_enabled status changes from true to false.
 */
export const suddenPayoutDisable = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // Only run this rule for account.updated events
  if (event.type !== 'account.updated' || !event.account) {
    return [];
  }

  const accountId = event.account;

  // Safely access config
  const enabled = ctx.config?.suddenPayoutDisable?.enabled ?? true; // Default to enabled
  if (!enabled) {
    return [];
  }

  const account = event.data.object as Stripe.Account;
  const previousAttributes = event.data.previous_attributes as Partial<Stripe.Account> | undefined;

  // Check if payouts_enabled changed specifically from true to false
  if (previousAttributes?.payouts_enabled === true && account.payouts_enabled === false) {
    logger.info({ accountId }, 'Sudden payout disable detected');

    return [
      {
        alertType: AlertType.SuddenPayoutDisable,
        severity: Severity.Medium,
        message: `Payouts were disabled for account ${accountId}. Investigate the reason in your Stripe dashboard.`,
        // payoutId: undefined,
      },
    ];
  }

  return [];
};
