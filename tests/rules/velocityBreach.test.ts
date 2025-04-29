import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { velocityBreach } from '@/lib/guardian/rules/velocityBreach';
// import { logger as actualLogger } from '@/lib/logger'; // Don't need actual logger
// import { createAdminClient } from '@/lib/supabase/admin'; // Removed as unused
import { PayoutEvent } from '@/lib/types'; // Assuming PayoutEvent type is defined here
import { Stripe } from 'stripe';
// Correct import path for AlertType and Severity
import { AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase'; // Make sure Tables type is imported if used in Partial<>

// Define mockLogger FIRST
// REMOVE this definition, define inside mock
/*
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
*/

// Mock logger at the top level and define implementation inline
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
// Remove edge logger mock if not used by this rule
// jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Mock Supabase admin client (this can stay top-level if needed)
// REMOVE THIS MOCK AS IT'S NOT USED BY THE RULE DIRECTLY
// jest.mock('@/lib/supabase/admin');

// Mock the rule-specific dependencies
// REMOVE THIS MOCK FUNCTION
// const mockGetPayoutsWithinWindow = jest.fn();

// REMOVE THIS DETAILED MOCK
/*
jest.mock('@/lib/supabase/admin', () => ({
  __esModule: true,
  createAdminClient: jest.fn(() => ({
    from: jest.fn((table) => {
      if (table === 'event_buffer') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          returns: jest.fn().mockImplementation(async () => ({
            data: await mockGetPayoutsWithinWindow(), // Wrap result in { data: ... }
            error: null,
          })),
        };
      }
      return { select: jest.fn().mockReturnThis() };
    }),
  })),
}));
*/

describe('Velocity Breach Rule', () => {
  // Need to import the mocked logger instance to clear it
  const { logger: mockLogger } = require('@/lib/logger');

  beforeEach(() => {
    // Clear previous mock calls, not the mocks themselves
    // jest.clearAllMocks(); // This clears all mocks, potentially including requireActual if used elsewhere
    // Clear specific logger mock calls instead
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Remove doMock calls as mock is now top-level
    // jest.doMock('@/lib/logger', () => ({ logger: mockLogger }));
    // jest.doMock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));
  });

  // Helper to create mock payout events (format expected by rule from DB)
  const createDbPayoutEvent = (id: string, timestamp: Date): Partial<Tables<'event_buffer'>> => ({
    id: `evt_${id}`,
    received_at: timestamp.toISOString(),
    type: 'payout.created',
    account_id: 'acct_test_123',
    payload: JSON.stringify({ id: `po_${id}` }),
  });

  // Helper to create mock Stripe event (input to the rule)
  const createStripeEvent = (type = 'payout.created') => ({
    id: 'evt_trigger_123',
    type,
    account: 'acct_123',
    data: {
      object: {
        id: 'po_trigger_123',
        object: 'payout',
      },
    },
  });

  it('should return empty array for non-payout events', async () => {
    const event = {
      ...createStripeEvent('charge.succeeded'),
    };
    const ctx = { config: { velocityBreach: { maxPayouts: 3, windowSeconds: 60 } } }; // No recentPayouts needed here

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(mockLogger.info).not.toHaveBeenCalled();
    // REMOVE THIS EXPECTATION
    // expect(mockGetPayoutsWithinWindow).not.toHaveBeenCalled();
  });

  it('should not trigger alert when payouts are below threshold', async () => {
    const now = new Date();
    const mockDbPayouts = [
      createDbPayoutEvent('1', new Date(now.getTime() - 30000)),
      createDbPayoutEvent('2', new Date(now.getTime() - 15000)),
    ];
    // REMOVE THIS MOCK RESOLVE
    // mockGetPayoutsWithinWindow.mockResolvedValueOnce({ data: mockDbPayouts, error: null });

    const event = createStripeEvent();
    const ctx = {
      config: { velocityBreach: { maxPayouts: 3, windowSeconds: 60 } },
      recentPayouts: mockDbPayouts,
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct_123', count: 2 }),
      'Velocity rule executed',
    );
  });

  it('should trigger alert when payouts meet or exceed threshold', async () => {
    const now = new Date();
    const mockDbPayouts = [
      createDbPayoutEvent('1', new Date(now.getTime() - 55000)),
      createDbPayoutEvent('2', new Date(now.getTime() - 30000)),
      createDbPayoutEvent('3', new Date(now.getTime() - 15000)),
    ];
    // REMOVE THIS MOCK RESOLVE
    // mockGetPayoutsWithinWindow.mockResolvedValueOnce({ data: mockDbPayouts, error: null });

    const event = createStripeEvent();
    const ctx = {
      config: { velocityBreach: { maxPayouts: 3, windowSeconds: 60 } },
      recentPayouts: mockDbPayouts,
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      alertType: AlertType.Velocity,
      severity: Severity.High,
      message: '🚨 3 payouts detected within 60 seconds (threshold: 3).',
      payoutId: 'po_trigger_123',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct_123', count: 3 }),
      'Velocity rule executed',
    );
  });

  it('should ignore payouts outside the time window', async () => {
    const now = new Date();
    const mockDbPayouts = [
      createDbPayoutEvent('1', new Date(now.getTime() - 65000)), // Outside 60s window
      createDbPayoutEvent('2', new Date(now.getTime() - 30000)),
      createDbPayoutEvent('3', new Date(now.getTime() - 15000)),
    ];
    // REMOVE THIS MOCK RESOLVE
    // mockGetPayoutsWithinWindow.mockResolvedValueOnce({ data: mockDbPayouts, error: null });

    const event = createStripeEvent();
    const ctx = {
      config: { velocityBreach: { maxPayouts: 3, windowSeconds: 60 } },
      recentPayouts: mockDbPayouts,
    };

    const result = await velocityBreach(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct_123', count: 2 }),
      'Velocity rule executed',
    );
  });
});
