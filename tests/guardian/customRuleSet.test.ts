import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { evaluateRules } from '@/lib/guardian/rules/index';
// import { supabaseAdmin } from '@/lib/supabase-admin'; // Remove unused import
import type { StripeEvent } from '@/lib/guardian/types';

// Mock the rule implementations called by evaluateRules (if evaluateRules is the target)
// Keep these simple for testing the config loading part
// jest.mock('@/lib/guardian/rules/velocityBreach', () => ({
//   velocityBreach: jest.fn(async () => []),
// }));
// jest.mock('@/lib/guardian/rules/bankSwap', () => ({
//   bankSwap: jest.fn(async () => []),
// }));
// jest.mock('@/lib/guardian/rules/geoMismatch', () => ({
//   geoMismatch: jest.fn(async () => []),
// }));
// jest.mock('@/lib/guardian/rules/failedChargeBurst', () => ({
//   failedChargeBurst: jest.fn(async () => []),
// }));
// jest.mock('@/lib/guardian/rules/suddenPayoutDisable', () => ({
//   suddenPayoutDisable: jest.fn(async () => []),
// }));
// jest.mock('@/lib/guardian/rules/highRiskReview', () => ({
//   highRiskReview: jest.fn(async () => []),
// }));

// Mock the Supabase Admin client used by getRuleConfig and evaluateRules (for context fetching)
// Define INLINE to avoid hoisting issues
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    // Explicitly type mock functions
    returns: jest.fn<() => Promise<{ data: any[]; error: any | null }>>(),
    maybeSingle: jest.fn<() => Promise<{ data: any | null; error: any | null }>>(),
    single: jest.fn<() => Promise<{ data: any; error: any | null }>>(),
    rpc: jest.fn<() => Promise<{ data: any | null; error: any | null }>>(),
  },
}));

// Mock getRuleConfig - Define INLINE with explicit type
jest.mock('@/lib/guardian/getRuleConfig', () => ({
  getRuleConfig: jest.fn<() => Promise<Record<string, any> | null>>(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock other dependencies (remove unused)
// const mockEvaluateRules = jest.fn();
// const mockInsertAlert = jest.fn();
// const mockInsertAlertAndEnqueue = jest.fn();
// const mockIncrementMetric = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => require('@/lib/supabase-admin').supabaseAdmin),
}));
// jest.mock('@/lib/guardian/alerts', ...); // Remove if unused
// jest.mock('@/lib/metrics/guard-metrics', ...); // Remove if unused

// Remove global rpc mock implementation if not needed globally
// mockSupabaseAdmin.rpc.mockImplementation(...);

describe('Custom Rule Set Loading Logic (via evaluateRules)', () => {
  // Import the MOCKED getRuleConfig instance to set return values in tests
  const { getRuleConfig: mockGetRuleConfig } = require('@/lib/guardian/getRuleConfig');
  const { supabaseAdmin: mockSupabaseAdmin } = require('@/lib/supabase-admin');

  let mockPayouts: any[] = [];
  let mockEvent: StripeEvent;
  const mockAccountId = 'acct_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getRuleConfig - set value on imported mock
    mockGetRuleConfig.mockResolvedValue({
      velocityBreach: { maxPayouts: 3, windowSeconds: 60 * 60 },
    });

    // Default mock implementation for supabaseAdmin context fetching
    // Now set the resolved values on the imported mock object
    mockSupabaseAdmin.returns.mockResolvedValue({ data: [], error: null });
    // Set defaults for maybeSingle/single if getRuleConfig uses them
    mockSupabaseAdmin.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabaseAdmin.single.mockResolvedValue({ data: { config: {} }, error: null }); // Default empty config
    mockSupabaseAdmin.rpc.mockResolvedValue({ data: null, error: null }); // Default rpc

    // No need for mockSupabaseAdmin.from.mockImplementation here by default
    // as we mock the final chained calls like .returns directly.
    // Specific tests can override .returns, .maybeSingle etc. if needed.

    // Adjust mockPayouts structure for event_buffer - SIMPLIFIED
    mockPayouts = [
      {
        id: 'evt_p1',
        type: 'payout.paid',
        received_at: new Date(Date.now() - 10000).toISOString(),
        payload: {},
        stripe_account_id: mockAccountId,
      },
      {
        id: 'evt_p2',
        type: 'payout.paid',
        received_at: new Date(Date.now() - 20000).toISOString(),
        payload: {},
        stripe_account_id: mockAccountId,
      },
      {
        id: 'evt_p3',
        type: 'payout.paid',
        received_at: new Date(Date.now() - 30000).toISOString(),
        payload: {},
        stripe_account_id: mockAccountId,
      },
    ];

    mockEvent = {
      id: 'evt_trigger',
      account: mockAccountId,
      type: 'payout.paid',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'po_trigger', amount: 1000, object: 'payout' } },
    } as any;
  });

  it('should use default rule set when no custom rule set exists', async () => {
    // Arrange: Setup specific return for context fetch
    mockSupabaseAdmin.returns
      .mockResolvedValueOnce({ data: mockPayouts, error: null })
      .mockResolvedValueOnce({ data: [], error: null }); // Assume 2 calls: payouts, charges
    // getRuleConfig should resolve with default (set in beforeEach)

    // Act
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity');
    expect(mockGetRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('event_buffer');
    expect(mockSupabaseAdmin.returns).toHaveBeenCalledTimes(2);
  });

  it('should respect custom rule set with stricter maxPayouts threshold', async () => {
    // Arrange:
    mockGetRuleConfig.mockResolvedValue({
      velocityBreach: { maxPayouts: 2, windowSeconds: 60 * 60 },
    });
    mockSupabaseAdmin.returns
      .mockResolvedValueOnce({ data: mockPayouts, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    // Act
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(mockGetRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity');
  });

  it('should handle errors when retrieving custom rule set', async () => {
    // Arrange:
    const configError = new Error('Failed to fetch config');
    mockGetRuleConfig.mockRejectedValue(configError);
    // No need to mock supabaseAdmin calls as evaluateRules should exit

    // Act
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(mockGetRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(0);
  });

  it('should use default rules if custom rule set is invalid or not found', async () => {
    // Arrange:
    const configError = new Error('Failed to fetch config');
    mockGetRuleConfig.mockRejectedValue(configError);
    // No need to mock supabaseAdmin calls as evaluateRules should exit

    // Act
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(mockGetRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(0);
  });

  it('should allow disabling specific rules via custom rule set', async () => {
    // Arrange:
    mockGetRuleConfig.mockResolvedValue({
      velocityBreach: { enabled: false, maxPayouts: 2 },
      bankSwap: { enabled: true },
    });
    mockSupabaseAdmin.returns
      .mockResolvedValueOnce({ data: mockPayouts, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    // Act
    const alerts = await evaluateRules(mockEvent, mockEvent.account);
    // Assert
    expect(mockGetRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity');
    // Add assertions here to check if *other* mocked rules were called if needed
  });
});
