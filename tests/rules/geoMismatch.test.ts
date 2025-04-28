import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { geoMismatch } from '@/lib/guardian/rules/geoMismatch';
import { logger } from '@/lib/logger';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Mock the rule-specific dependencies
const mockGetPayouts = jest.fn();
const mockGetCharges = jest.fn();
jest.mock('@/lib/stripe/api', () => ({
  getPayouts: mockGetPayouts,
  getCharges: mockGetCharges,
}));

describe('Geo Mismatch Rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock charge events
  const createChargeEvent = (ipCountry = 'US') => ({
    id: `ch_${Math.random().toString(36).substring(2, 8)}`,
    type: 'charge.succeeded',
    event_data: {
      ip_country: ipCountry,
      billing_details: {
        address: {
          country: ipCountry,
        },
      },
    },
  });

  // Helper to create mock Stripe payout event
  const createStripePayoutEvent = (bankCountry = 'US') => ({
    id: 'evt_123',
    type: 'payout.created',
    account: 'acct_123',
    data: {
      object: {
        id: 'po_123',
        object: 'payout',
        destination: {
          account_country: bankCountry,
        },
        currency: 'usd',
      },
    },
  });

  it('should return empty array for non-payout events', async () => {
    const event = {
      id: 'evt_123',
      type: 'charge.succeeded',
      account: 'acct_123',
      data: { object: {} },
    };

    const ctx = {
      recentPayouts: [],
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not trigger alert when charge countries match bank country', async () => {
    const event = createStripePayoutEvent('US');

    // All charges have same country as bank
    const recentCharges = [
      createChargeEvent('US'),
      createChargeEvent('US'),
      createChargeEvent('US'),
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 0 },
      'Geo-mismatch rule executed',
    );
  });

  it('should not trigger alert when mismatches are below threshold', async () => {
    const event = createStripePayoutEvent('US');

    // Only one charge has different country
    const recentCharges = [
      createChargeEvent('US'),
      createChargeEvent('US'),
      createChargeEvent('NG'), // Only one from Nigeria
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 }, // Threshold is 2
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 1 },
      'Geo-mismatch rule executed',
    );
  });

  it('should trigger alert when mismatches meet or exceed threshold', async () => {
    const event = createStripePayoutEvent('US');

    // Three charges from Nigeria (different from US bank)
    const recentCharges = [
      createChargeEvent('NG'),
      createChargeEvent('NG'),
      createChargeEvent('NG'),
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 }, // Threshold is 2
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'GEO_MISMATCH',
      severity: 'medium',
      message: 'Detected 3 charges from foreign IPs vs bank country US',
      payoutId: 'po_123',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    });
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 3 },
      'Geo-mismatch rule executed',
    );
  });

  it('should handle charges with missing country info gracefully', async () => {
    const event = createStripePayoutEvent('US');

    // Mix of charges with and without country info
    const recentCharges = [
      createChargeEvent('NG'),
      { id: 'ch_123', type: 'charge.succeeded', event_data: {} }, // No country
      createChargeEvent('NG'),
      { id: 'ch_456', type: 'charge.succeeded', event_data: { ip_country: null } }, // Null country
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 }, // Threshold is 2
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 2 },
      'Geo-mismatch rule executed',
    );
  });

  it('should handle payout with missing bank country gracefully', async () => {
    // Payout with no destination info
    const event = {
      id: 'evt_123',
      type: 'payout.created',
      account: 'acct_123',
      data: {
        object: {
          id: 'po_123',
          object: 'payout',
          // No destination or currency info
        },
      },
    };

    const recentCharges = [
      createChargeEvent('NG'),
      createChargeEvent('NG'),
      createChargeEvent('NG'),
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 0 },
      'Geo-mismatch rule executed',
    );
  });

  it('should use currency code as bank country fallback', async () => {
    // Payout with no destination info but with currency
    const event = {
      id: 'evt_123',
      type: 'payout.created',
      account: 'acct_123',
      data: {
        object: {
          id: 'po_123',
          object: 'payout',
          currency: 'usd', // USD -> US
        },
      },
    };

    const recentCharges = [
      createChargeEvent('NG'),
      createChargeEvent('NG'),
      createChargeEvent('NG'),
    ];

    const ctx = {
      recentPayouts: [],
      recentCharges,
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('bank country us');
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', mismatches: 3 },
      'Geo-mismatch rule executed',
    );
  });
});
