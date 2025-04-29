import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

describe('stripe singleton', () => {
  const originalEnv = process.env;
  let mockStripeConstructor: any;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'test_key';

    mockStripeConstructor = vi.fn();
    vi.doMock('stripe', () => {
      return {
        __esModule: true,
        default: mockStripeConstructor,
      };
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws an error when STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(async () => await import('../../lib/stripe')).rejects.toThrow(
      '⛔️  STRIPE_SECRET_KEY env var is missing.',
    );
  });

  it('creates a Stripe instance with the correct configuration', async () => {
    const { stripe } = await import('../../lib/stripe');

    expect(mockStripeConstructor).toHaveBeenCalledWith('test_key', {
      apiVersion: '2024-06-20',
      typescript: true,
      appInfo: {
        name: 'Guardian v2',
        version: '0.0.1',
        url: 'https://guardian.dock108.com',
      },
    });
    expect(stripe).toBeDefined();
  });
});
