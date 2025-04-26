import { z } from 'zod';
import { Stripe } from '@/lib/stripe';
import { GUARDIAN_EVENTS } from './stripeEvents';

// Common fields for all Stripe events
const baseEventSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  api_version: z.string().nullable().optional(),
  created: z.number(),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z
    .object({
      id: z.string().nullable().optional(),
      idempotency_key: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  data: z.object({
    object: z.record(z.any()),
    previous_attributes: z.record(z.any()).optional(),
  }),
});

// Charge events
const chargeSucceededSchema = baseEventSchema.extend({
  type: z.literal('charge.succeeded'),
  account: z.string().optional(),
});

const chargeFailedSchema = baseEventSchema.extend({
  type: z.literal('charge.failed'),
  account: z.string().optional(),
});

const chargeRefundedSchema = baseEventSchema.extend({
  type: z.literal('charge.refunded'),
  account: z.string().optional(),
});

const chargeCapturedSchema = baseEventSchema.extend({
  type: z.literal('charge.captured'),
  account: z.string().optional(),
});

const chargeDisputeCreatedSchema = baseEventSchema.extend({
  type: z.literal('charge.dispute.created'),
  account: z.string().optional(),
});

// Payout events
const payoutCreatedSchema = baseEventSchema.extend({
  type: z.literal('payout.created'),
  account: z.string().optional(),
});

const payoutUpdatedSchema = baseEventSchema.extend({
  type: z.literal('payout.updated'),
  account: z.string().optional(),
});

const payoutPaidSchema = baseEventSchema.extend({
  type: z.literal('payout.paid'),
  account: z.string().optional(),
});

const payoutFailedSchema = baseEventSchema.extend({
  type: z.literal('payout.failed'),
  account: z.string().optional(),
});

// Account events
const accountUpdatedSchema = baseEventSchema.extend({
  type: z.literal('account.updated'),
  account: z.string().optional(),
});

const accountExternalAccountCreatedSchema = baseEventSchema.extend({
  type: z.literal('account.external_account.created'),
  account: z.string().optional(),
});

const accountExternalAccountUpdatedSchema = baseEventSchema.extend({
  type: z.literal('account.external_account.updated'),
  account: z.string().optional(),
});

const accountExternalAccountDeletedSchema = baseEventSchema.extend({
  type: z.literal('account.external_account.deleted'),
  account: z.string().optional(),
});

// Map each event type to its schema
const schemaMap = {
  'charge.succeeded': chargeSucceededSchema,
  'charge.failed': chargeFailedSchema,
  'charge.refunded': chargeRefundedSchema,
  'charge.captured': chargeCapturedSchema,
  'charge.dispute.created': chargeDisputeCreatedSchema,
  'payout.created': payoutCreatedSchema,
  'payout.updated': payoutUpdatedSchema,
  'payout.paid': payoutPaidSchema,
  'payout.failed': payoutFailedSchema,
  'account.updated': accountUpdatedSchema,
  'account.external_account.created': accountExternalAccountCreatedSchema,
  'account.external_account.updated': accountExternalAccountUpdatedSchema,
  'account.external_account.deleted': accountExternalAccountDeletedSchema,
};

// Validate that all GUARDIAN_EVENTS have schemas
for (const eventType of GUARDIAN_EVENTS) {
  if (!schemaMap[eventType]) {
    throw new Error(`Missing schema for event type: ${eventType}`);
  }
}

// Create a union of all event schemas
export const StripeEventSchema = z.union([
  chargeSucceededSchema,
  chargeFailedSchema,
  chargeRefundedSchema,
  chargeCapturedSchema,
  chargeDisputeCreatedSchema,
  payoutCreatedSchema,
  payoutUpdatedSchema,
  payoutPaidSchema,
  payoutFailedSchema,
  accountUpdatedSchema,
  accountExternalAccountCreatedSchema,
  accountExternalAccountUpdatedSchema,
  accountExternalAccountDeletedSchema,
]);

// Type for the parsed result
export type ValidatedStripeEvent = z.infer<typeof StripeEventSchema>;
