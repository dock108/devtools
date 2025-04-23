import type { RuleFn } from '../types';
import { logger } from '@/lib/logger';

export const velocityBreach: RuleFn = async (evt, ctx) => {
  if (!evt.type.startsWith('payout.')) return [];

  const accountId = evt.account as string;
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
        payoutId: (evt.data.object as any).id,
        accountId: evt.account!,
        createdAt: new Date().toISOString(),
      },
    ];
  }
  return [];
}; 