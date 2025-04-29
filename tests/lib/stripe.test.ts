import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

describe('stripe singleton', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'test_key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws an error when STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => require('../stripe')).toThrow('⛔️  STRIPE_SECRET_KEY env var is missing.');
  });

  it('creates a Stripe instance with the correct configuration', () => {
    const mockStripeConstructor = vi.fn();
    vi.mock('stripe', () => {
      return {
        default: mockStripeConstructor,
      };
    });

    require('../stripe');

    expect(mockStripeConstructor).toHaveBeenCalledWith('test_key', {
      apiVersion: '2024-04-10',
      appInfo: { name: 'Stripe Guardian', version: '0.1.0' },
    });
  });
});
