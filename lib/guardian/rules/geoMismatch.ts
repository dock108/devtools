import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index';
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';
import { Tables, Json } from '@/types/supabase';

// Helper to try and extract country from charge-related event payload
function getChargeCountry(payload: Json | null): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  // Check for common charge object properties
  if (
    'payment_method_details' in payload &&
    payload.payment_method_details &&
    typeof payload.payment_method_details === 'object'
  ) {
    const pmDetails = payload.payment_method_details as any; // Use any carefully
    if (pmDetails.card?.country) return pmDetails.card.country;
    // Add checks for other payment method types if needed (e.g., pmDetails.ideal?.bank)
  }
  if (
    'billing_details' in payload &&
    payload.billing_details &&
    typeof payload.billing_details === 'object'
  ) {
    const billingDetails = payload.billing_details as any;
    if (billingDetails.address?.country) return billingDetails.address.country;
  }
  // Source object (older style)
  if ('source' in payload && payload.source && typeof payload.source === 'object') {
    const source = payload.source as any;
    if (source.card?.country) return source.card.country;
    if (source.owner?.address?.country) return source.owner.address.country;
  }

  // Attempt to get IP country (less reliable, might be on event request)
  // This usually needs access to the top-level event.request, not just data.object
  // Consider passing event.request into the rule if needed.

  return undefined;
}

/**
 * RULE: Geo Mismatch
 * Detects if a payout bank country differs significantly from the countries
 * associated with recent charge events for the same account.
 */
export const geoMismatch = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // Only inspect payout.created or payout.paid events
  if ((event.type !== 'payout.created' && event.type !== 'payout.paid') || !event.account) {
    return [];
  }

  const accountId = event.account;
  const payout = event.data.object as Stripe.Payout;

  // Determine payout destination country
  let bankCountry: string | undefined;
  if (
    payout.destination &&
    typeof payout.destination === 'object' &&
    'bank_account' in payout.destination
  ) {
    const bankAccount = payout.destination.bank_account as any; // Might need Stripe.BankAccount type
    bankCountry = bankAccount?.country;
  } else if (payout.destination && typeof payout.destination === 'string') {
    // If destination is just an ID, we might need to retrieve it separately (costly)
    // Or rely on currency as a fallback
    bankCountry = payout.currency?.substring(0, 2).toUpperCase();
  } else {
    bankCountry = payout.currency?.substring(0, 2).toUpperCase();
  }

  if (!bankCountry) {
    logger.warn(
      { accountId, payoutId: payout.id },
      'Geo-mismatch: Could not determine bank country.',
    );
    return [];
  }

  // Safely access config
  const config = ctx.config?.geoMismatch ?? {};
  const mismatchChargeCount =
    typeof config.mismatchChargeCount === 'number' ? config.mismatchChargeCount : 3; // Default 3

  // Collect country codes from recent charges
  let mismatchCount = 0;
  const chargeCountries = new Set<string>();

  // Add check to ensure recentCharges exists and is iterable
  if (Array.isArray(ctx.recentCharges)) {
    for (const chargeEvent of ctx.recentCharges as Tables<'event_buffer'>[]) {
      const chargePayload = chargeEvent.payload;
      const chargeCountry = getChargeCountry(chargePayload);
      if (chargeCountry) {
        chargeCountries.add(chargeCountry);
        if (chargeCountry !== bankCountry) {
          mismatchCount++;
        }
      }
    }
  } else {
    // Optionally log if recentCharges is missing when expected
    logger.warn(
      { accountId, payoutId: payout.id },
      'Recent charges data missing or invalid in context for geo-mismatch rule.',
    );
  }

  logger.info(
    {
      accountId,
      payoutId: payout.id,
      bankCountry,
      chargeCountries: Array.from(chargeCountries),
      mismatchCount,
      threshold: mismatchChargeCount,
    },
    'Geo-mismatch rule executed',
  );

  if (mismatchCount >= mismatchChargeCount) {
    return [
      {
        alertType: AlertType.GeoMismatch,
        severity: Severity.Medium,
        message: `Potential geo-mismatch: ${mismatchCount} recent charge(s) from countries (${Array.from(chargeCountries).join(', ')}) differ from payout bank country (${bankCountry}).`,
        accountId: accountId,
        payoutId: payout.id,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
};
