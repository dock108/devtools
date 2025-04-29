import { bankSwap } from '@/lib/guardian/rules/bankSwap';
import { logger } from '@/lib/logger';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RuleContext } from '@/lib/guardian/rules/index';
import { AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase'; // Import Tables

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
  const { logger: mockLogger } = require('@/lib/logger');

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() for consistent time comparisons
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => new Date('2024-01-01T12:00:00.000Z').getTime());
  });

  afterEach(() => {
    // Restore Date.now() mock
    jest.restoreAllMocks();
  });

  // Helper to create mock event_buffer entries
  const createMockEventBufferEntry = (
    id: string,
    type: string,
    timestamp: Date,
  ): Partial<Tables<'event_buffer'>> => ({
    id: `evt_${id}`,
    type,
    received_at: timestamp.toISOString(),
    stripe_account_id: 'acct_123',
    payload: {}, // Payload not directly used by bankSwap filter logic
  });

  // Helper to create mock Stripe payout event (Input event)
  const createStripePayoutEvent = (amount = 150000) => ({
    id: 'evt_trigger_123',
    type: 'payout.created',
    account: 'acct_123',
    data: {
      object: {
        id: 'po_123',
        object: 'payout',
        amount, // in cents
        currency: 'usd',
        // destination not needed by this rule's logic
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
  });

  it('should not trigger alert when payout amount is below threshold', async () => {
    // Payout of $200 (below $1000 threshold)
    const event = createStripePayoutEvent(20000);

    // External account created 3 minutes ago
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const recentPayouts = [
      createMockEventBufferEntry('ea_123', 'external_account.created', threeMinutesAgo),
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
  });

  it('should not trigger alert when bank change is outside lookback window', async () => {
    const now = Date.now(); // Use mocked Date.now()
    const lookbackMinutes = 30;
    const event = createStripePayoutEvent(200000); // $2000 (above threshold)

    // Bank change event created *before* the lookback window
    const bankChangeTime = new Date(now - (lookbackMinutes + 5) * 60 * 1000);
    const mockEvents = [
      createMockEventBufferEntry('bank_old', 'external_account.created', bankChangeTime),
      // Add some other irrelevant events
      createMockEventBufferEntry('payout1', 'payout.paid', new Date(now - 10 * 60 * 1000)),
    ];

    const ctx = {
      recentPayouts: mockEvents, // Provide mock events
      config: { bankSwap: { lookbackMinutes, minPayoutUsd: 1000 } },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        payoutAmount: 2000, // $2000.00
        bankChangeFound: false, // Event was outside window
      },
      'Bank-swap rule evaluated',
    );
  });

  it('should trigger alert when large payout follows recent external account change', async () => {
    const now = Date.now(); // Use mocked Date.now()
    const lookbackMinutes = 30;
    const event = createStripePayoutEvent(200000); // $2000

    // Bank change event created *within* the lookback window
    const bankChangeTime = new Date(now - (lookbackMinutes - 5) * 60 * 1000);
    const mockEvents = [
      createMockEventBufferEntry('bank_recent', 'external_account.created', bankChangeTime),
      createMockEventBufferEntry('payout1', 'payout.paid', new Date(now - 10 * 60 * 1000)),
    ];

    const ctx = {
      recentPayouts: mockEvents, // Provide mock events
      config: { bankSwap: { lookbackMinutes, minPayoutUsd: 1000 } },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toHaveLength(1);
    // Update Alert expectation
    expect(result[0]).toEqual({
      alertType: AlertType.BankSwap,
      severity: Severity.High,
      // Message depends on exact timing (now - bankChangeTime)
      // bankChangeTime = now - (30 - 5) * 60 * 1000 = now - 25 * 60 * 1000
      // timeDiff = now - bankChangeTime = 25 * 60 * 1000 ms = 25 mins
      message: 'Potential bank swap: External account created ~25 min before a $2000.00 payout.',
      accountId: 'acct_123',
      payoutId: 'po_123',
      createdAt: expect.any(String),
    });
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        payoutAmount: 2000,
        bankChangeFound: true, // Event was found within window
      },
      'Bank-swap rule evaluated',
    );
  });

  it('should not trigger alert when no external account changes found', async () => {
    const now = Date.now(); // Use mocked Date.now()
    const lookbackMinutes = 30;
    const event = createStripePayoutEvent(200000); // $2000

    // No bank change events
    const mockEvents = [
      createMockEventBufferEntry('payout1', 'payout.paid', new Date(now - 10 * 60 * 1000)),
      createMockEventBufferEntry('payout2', 'payout.created', new Date(now - 5 * 60 * 1000)),
    ];

    const ctx = {
      recentPayouts: mockEvents, // Provide mock events (no bank changes)
      config: { bankSwap: { lookbackMinutes, minPayoutUsd: 1000 } },
    };

    const result = await bankSwap(event as any, ctx as any);
    expect(result).toEqual([]);
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        payoutAmount: 2000,
        bankChangeFound: false, // No external_account.created events provided
      },
      'Bank-swap rule evaluated',
    );
  });
});
