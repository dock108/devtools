/**
 * Guardian events copy for use in script environment
 *
 * Duplicated from lib/guardian/stripeEvents.ts to avoid import
 * issues when running with ts-node
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
