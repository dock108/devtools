import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index';
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase';

/**
 * RULE: Bank Swap
 * Detects if a large payout follows a recent external account creation.
 */
export const bankSwap = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // Only inspect payout.created or payout.paid events
  if ((event.type !== 'payout.created' && event.type !== 'payout.paid') || !event.account) {
    return [];
  }

  const accountId = event.account;
  const payout = event.data.object as Stripe.Payout; // Assert type (ensure validation upstream)

  // Safely access config with defaults
  const config = ctx.config?.bankSwap ?? {};
  const minPayoutUsd = typeof config.minPayoutUsd === 'number' ? config.minPayoutUsd : 1000; // Default $1000
  const lookbackMinutes = typeof config.lookbackMinutes === 'number' ? config.lookbackMinutes : 30; // Default 30 mins

  const payoutAmount = payout.amount / 100; // Amount is in cents

  // Ignore small payouts
  if (payoutAmount < minPayoutUsd) {
    return [];
  }

  // Find latest external_account.created within the lookback window
  const lookbackCutoffTime = Date.now() - lookbackMinutes * 60 * 1000;

  // Assuming recentPayouts context contains event_buffer entries
  // TODO: Adapt if context provides parsed event objects
  const recentBankChangeEvent = ctx.recentPayouts.find(
    (p: Tables<'event_buffer'>) =>
      p.type === 'external_account.created' &&
      p.received_at &&
      new Date(p.received_at).getTime() >= lookbackCutoffTime,
  );

  logger.info(
    { accountId, payoutId: payout.id, payoutAmount, bankChangeFound: !!recentBankChangeEvent },
    'Bank-swap rule evaluated',
  );

  if (!recentBankChangeEvent) {
    return [];
  }

  return [
    {
      alertType: AlertType.BankSwap,
      severity: Severity.High,
      message: `Potential bank swap: External account created ~${Math.round((Date.now() - new Date(recentBankChangeEvent.received_at!).getTime()) / 60000)} min before a $${payoutAmount.toFixed(2)} payout.`,
      payoutId: payout.id,
    },
  ];
};
