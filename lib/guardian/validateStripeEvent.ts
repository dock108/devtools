import { StripeEventSchema, ValidatedStripeEvent } from './stripeSchemas';
import { GUARDIAN_EVENTS } from './stripeEvents';
import { ZodError } from 'zod';

/**
 * Validates a Stripe event payload against the schema
 *
 * @param payload Unknown data to validate
 * @returns ValidatedStripeEvent on success
 * @throws ZodError if validation fails
 */
export const validateStripeEvent = (payload: unknown): ValidatedStripeEvent => {
  // First check if the event type is supported
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    typeof payload.type === 'string' &&
    !GUARDIAN_EVENTS.includes(payload.type as any)
  ) {
    throw new Error(`Unsupported event type: ${payload.type}`);
  }

  // Then validate the full payload against the schema
  return StripeEventSchema.parse(payload);
};

/**
 * Checks if strict validation is enabled
 * Default is true, can be disabled with STRICT_STRIPE_VALIDATION=false
 */
export const isStrictValidationEnabled = (): boolean => {
  return process.env.STRICT_STRIPE_VALIDATION !== 'false';
};
