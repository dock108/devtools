import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { velocityBreach } from '@/lib/guardian/rules/velocityBreach';
import { logger } from '@/lib/logger';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Mock the rule-specific dependencies
const mockGetPayoutsWithinWindow = jest.fn();
jest.mock('@/lib/supabase/admin', () => ({
  __esModule: true,
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      returns: jest.fn().mockImplementation(mockGetPayoutsWithinWindow),
    })),
  })),
}));

describe('Velocity Breach Rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock payout events
  const createPayoutEvent = (id: string, timestamp: Date) => ({
    id: `pi_${id}`,
    created_at: timestamp.toISOString(),
    stripe_account_id: 'acct_123',
    amount: 5000,
    currency: 'usd',
  });

  // Helper to create mock Stripe event
  const createStripeEvent = (type = 'payout.created') => ({
    id: 'evt_123',
    type,
    account: 'acct_123',
    data: {
      object: {
        id: 'po_123',
        object: 'payout',
      },
    },
  });

  it('should return empty array for non-payout events', async () => {
    const event = {
      ...createStripeEvent('charge.succeeded'),
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

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not trigger alert when payouts are below threshold', async () => {
    const now = new Date();
    const recentPayouts = [
      createPayoutEvent('1', new Date(now.getTime() - 30000)), // 30 seconds ago
      createPayoutEvent('2', new Date(now.getTime() - 15000)), // 15 seconds ago
    ];

    const event = createStripeEvent();
    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', count: 2 },
      'Velocity rule executed',
    );
  });

  it('should trigger alert when payouts meet or exceed threshold', async () => {
    const now = new Date();
    const recentPayouts = [
      createPayoutEvent('1', new Date(now.getTime() - 55000)), // 55 seconds ago
      createPayoutEvent('2', new Date(now.getTime() - 30000)), // 30 seconds ago
      createPayoutEvent('3', new Date(now.getTime() - 15000)), // 15 seconds ago
    ];

    const event = createStripeEvent();
    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'VELOCITY',
      severity: 'high',
      message: '🚨 3 payouts inside 60s',
      payoutId: 'po_123',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    });
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', count: 3 },
      'Velocity rule executed',
    );
  });

  it('should ignore payouts outside the time window', async () => {
    const now = new Date();
    const recentPayouts = [
      createPayoutEvent('1', new Date(now.getTime() - 65000)), // 65 seconds ago - outside window
      createPayoutEvent('2', new Date(now.getTime() - 30000)), // 30 seconds ago
      createPayoutEvent('3', new Date(now.getTime() - 15000)), // 15 seconds ago
    ];

    const event = createStripeEvent();
    const ctx = {
      recentPayouts,
      recentCharges: [],
      config: {
        velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
        bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
        geoMismatch: { mismatchChargeCount: 2 },
      },
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      { accountId: 'acct_123', count: 2 },
      'Velocity rule executed',
    );
  });
});
