import { bankSwap } from '@/lib/guardian/rules/bankSwap';
import { logger } from '@/lib/logger';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Mock the rule-specific dependencies
const mockFindMostRecentExternalAccountChange = jest.fn();
jest.mock('@/lib/supabase/admin', () => ({
  __esModule: true,
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockImplementation(mockFindMostRecentExternalAccountChange),
    })),
  })),
}));

describe('Bank Swap Rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Date.now() to ensure consistent test results
    jest.spyOn(Date, 'now').mockImplementation(() => 1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to create mock event objects
  const createPayoutEvent = (type: string, id: string, timestamp: Date, amount = 150000) => ({
    id: id,
    type,
    created_at: timestamp.toISOString(),
    stripe_account_id: 'acct_123',
    amount,
    currency: 'usd',
  });

  // Helper to create mock Stripe payout event
  const createStripePayoutEvent = (amount = 150000) => ({
    id: 'evt_123',
    type: 'payout.created',
    account: 'acct_123',
    data: {
      object: {
        id: 'po_123',
        object: 'payout',
        amount,
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

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith({ accountId: 'acct_123' }, 'Bank-swap rule evaluated');
  });

  it('should not trigger alert when payout amount is below threshold', async () => {
    // Payout of $200 (below $1000 threshold)
    const event = createStripePayoutEvent(20000);

    // External account created 3 minutes ago
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const recentPayouts = [
      createPayoutEvent('external_account.created', 'ea_123', threeMinutesAgo),
    ];

    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith({ accountId: 'acct_123' }, 'Bank-swap rule evaluated');
  });

  it('should not trigger alert when bank change is outside lookback window', async () => {
    // Payout of $1500 (above $1000 threshold)
    const event = createStripePayoutEvent(150000);

    // External account created 10 minutes ago (outside 5 min window)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentPayouts = [createPayoutEvent('external_account.created', 'ea_123', tenMinutesAgo)];

    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith({ accountId: 'acct_123' }, 'Bank-swap rule evaluated');
  });

  it('should trigger alert when large payout follows recent external account change', async () => {
    // Payout of $1500 (above $1000 threshold)
    const event = createStripePayoutEvent(150000);

    // External account created 3 minutes ago (within 5 min window)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const recentPayouts = [
      createPayoutEvent('external_account.created', 'ea_123', threeMinutesAgo),
    ];

    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'BANK_SWAP',
      severity: 'high',
      message: 'Bank account swapped 5 min before $1500 payout',
      payoutId: 'po_123',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    });
    expect(logger.info).toHaveBeenCalledWith({ accountId: 'acct_123' }, 'Bank-swap rule evaluated');
  });

  it('should not trigger alert when no external account changes found', async () => {
    // Payout of $1500 (above $1000 threshold)
    const event = createStripePayoutEvent(150000);

    // No external_account.created events
    const recentPayouts = [
      createPayoutEvent('payout.created', 'po_456', new Date(Date.now() - 2 * 60 * 1000)),
    ];

    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith({ accountId: 'acct_123' }, 'Bank-swap rule evaluated');
  });
});
