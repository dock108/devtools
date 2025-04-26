/**
 * Canonical list of Stripe events needed by Guardian
 *
 * This list controls:
 * 1. What events the webhook endpoint subscribes to
 * 2. Which events are accepted by the webhook handler
 *
 * If you modify this list, run `npm run stripe:setup-webhook` to update the
 * webhook configuration on Stripe
 */

/**
 * Guardian events and their purposes:
 *
 * payout.* events:
 *   - Required for payout velocity check (payout.created, payout.paid)
 *   - Needed for bank-swap rule
 *   - Needed for geo-mismatch rule
 *
 * account.updated:
 *   - Monitors changes to connected accounts
 *
 * account.external_account.created:
 *   - Used by bank-swap rule to detect new bank accounts
 *
 * charge.* events:
 *   - Used by geo-mismatch rule to detect charges from foreign locations
 */
export const GUARDIAN_EVENTS = [
  // Payout events
  'payout.created',
  'payout.updated',
  'payout.paid',
  'payout.failed',

  // Account events
  'account.updated',
  'account.external_account.created',
  'account.external_account.updated',
  'account.external_account.deleted',

  // Charge events
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',
  'charge.captured',
  'charge.dispute.created',
];

/**
 * Checks if an event type is supported by Guardian
 */
export function isGuardianSupportedEvent(eventType: string): boolean {
  return (
    GUARDIAN_EVENTS.includes(eventType) ||
    GUARDIAN_EVENTS.some((supported) => {
      // Handle wildcards like 'payout.*'
      const wildcardIndex = supported.indexOf('.*');
      if (wildcardIndex !== -1) {
        const prefix = supported.substring(0, wildcardIndex);
        return eventType.startsWith(prefix);
      }
      return false;
    })
  );
}
