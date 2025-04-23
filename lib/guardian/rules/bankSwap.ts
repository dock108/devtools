import type { RuleFn } from '../types';
import { logger } from '@/lib/logger';

export const bankSwap: RuleFn = async (evt, ctx) => {
  // Log for all events
  logger.info({ accountId: evt.account }, 'Bank-swap rule evaluated');
  
  // Only inspect payout events
  if (!evt.type.startsWith('payout.')) return [];

  const payout = evt.data.object as any;
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
      accountId: evt.account!,
      createdAt: new Date().toISOString(),
    },
  ];
}; 