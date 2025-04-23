import type { RuleFn } from '../types';
import { logger } from '@/lib/logger';

export const geoMismatch: RuleFn = async (evt, ctx) => {
  if (!evt.type.startsWith('payout.')) return [];

  const payout = evt.data.object as any;
  const bankCountry = payout.destination?.account_country || payout.currency?.slice(0, 2);

  // Collect last-day charges for this account
  const mismatches = ctx.recentCharges.filter((c) => {
    const chargeCountry = c.event_data.ip_country ?? c.event_data.billing_details?.address?.country;
    return chargeCountry && bankCountry && chargeCountry !== bankCountry;
  });

  logger.info({ accountId: evt.account, mismatches: mismatches.length }, 'Geo-mismatch rule executed');

  if (mismatches.length < ctx.config.geoMismatch.mismatchChargeCount) return [];

  return [
    {
      type: 'GEO_MISMATCH',
      severity: 'medium',
      message: `Detected ${mismatches.length} charges from foreign IPs vs bank country ${bankCountry}`,
      payoutId: payout.id,
      accountId: evt.account!,
      createdAt: new Date().toISOString(),
    },
  ];
}; 