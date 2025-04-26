import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateStripeEvent } from '@/lib/guardian/validateStripeEvent';
import { ZodError } from 'zod';

// Mock the environment variable
jest.mock('process', () => ({
  env: {
    STRICT_STRIPE_VALIDATION: 'true',
  },
}));

describe('Stripe Event Validation', () => {
  // Valid charge.failed event fixture
  const validChargeFailedEvent = {
    id: 'evt_test_123',
    object: 'event',
    api_version: '2023-10-16',
    created: 1684943826,
    data: {
      object: {
        id: 'ch_test_123',
        object: 'charge',
        amount: 2000,
        status: 'failed',
        currency: 'usd',
      },
    },
    livemode: false,
    pending_webhooks: 1,
    type: 'charge.failed',
  };

  // Event with missing required field
  const invalidEventMissingField = {
    id: 'evt_test_456',
    object: 'event',
    // Missing 'created' field
    data: {
      object: {
        id: 'ch_test_456',
        object: 'charge',
        amount: 2000,
        currency: 'usd',
      },
    },
    livemode: false,
    pending_webhooks: 1,
    type: 'charge.failed',
  };

  // Event with unsupported type
  const unsupportedEventType = {
    id: 'evt_test_789',
    object: 'event',
    api_version: '2023-10-16',
    created: 1684943826,
    data: {
      object: {
        id: 'cus_test_789',
        object: 'customer',
        email: 'test@example.com',
      },
    },
    livemode: false,
    pending_webhooks: 1,
    type: 'customer.created',
  };

  it('should validate a valid charge.failed event', () => {
    // Should not throw an error for valid event
    expect(() => validateStripeEvent(validChargeFailedEvent)).not.toThrow();
    const validatedEvent = validateStripeEvent(validChargeFailedEvent);
    expect(validatedEvent.type).toBe('charge.failed');
  });

  it('should reject an event with missing required field', () => {
    // Should throw a ZodError for missing field
    expect(() => validateStripeEvent(invalidEventMissingField)).toThrow(ZodError);

    try {
      validateStripeEvent(invalidEventMissingField);
      fail('Expected validation to fail');
    } catch (err) {
      if (err instanceof ZodError) {
        expect(err.errors.length).toBeGreaterThan(0);
        // We just care that it failed validation
        expect(err.message).toBeTruthy();
      } else {
        fail('Expected ZodError');
      }
    }
  });

  it('should reject an unsupported event type', () => {
    // Should throw an error about unsupported event type
    expect(() => validateStripeEvent(unsupportedEventType)).toThrow('Unsupported event type');

    try {
      validateStripeEvent(unsupportedEventType);
      fail('Expected validation to fail');
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).toContain('Unsupported event type');
        expect(err.message).toContain('customer.created');
      } else {
        fail('Expected Error');
      }
    }
  });

  it('should handle null or undefined input', () => {
    // Should throw ZodError for null or undefined
    expect(() => validateStripeEvent(null)).toThrow();
    expect(() => validateStripeEvent(undefined)).toThrow();
  });
});
