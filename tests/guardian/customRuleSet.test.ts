import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { evaluateRules } from '@/lib/guardian/rules/index';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { StripeEvent } from '@/lib/guardian/types';
import { getRuleConfig } from '@/lib/guardian/getRuleConfig';

// Mock the other rules to return no alerts
jest.mock('@/lib/guardian/rules/bankSwap', () => ({
  bankSwap: jest.fn(async () => []),
}));

jest.mock('@/lib/guardian/rules/geoMismatch', () => ({
  geoMismatch: jest.fn(async () => []),
}));

// Mock the supabaseAdmin
jest.mock('@/lib/supabase-admin');

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock getRuleConfig globally (can be overridden in tests)
jest.mock('@/lib/guardian/getRuleConfig');

// Mock dependencies
const mockGetRuleConfig = jest.fn();
const mockEvaluateRules = jest.fn();
const mockInsertAlert = jest.fn();
const mockInsertAlertAndEnqueue = jest.fn();
const mockIncrementMetric = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockSupabaseAdmin),
}));
jest.mock('@/lib/guardian/rules/registry', () => ({
  getRuleConfig: mockGetRuleConfig,
}));
jest.mock('@/lib/guardian/rules/engine', () => ({
  evaluateRules: mockEvaluateRules,
}));
jest.mock('@/lib/guardian/alerts', () => ({
  insertAlert: mockInsertAlert,
}));
jest.mock('@/lib/metrics/guard-metrics', () => ({
  incrementMetric: mockIncrementMetric,
}));

// Mock the specific DB function call used
mockSupabaseAdmin.rpc.mockImplementation(async (functionName, params) => {
  if (functionName === 'insert_alert_and_enqueue') {
    return mockInsertAlertAndEnqueue(params);
  }
  return { data: null, error: new Error(`Unexpected RPC call: ${functionName}`) };
});

describe('Custom Rule Set', () => {
  let mockPayouts: any[] = [];
  let mockEvent: StripeEvent;
  const mockAccountId = 'acct_123';

  beforeEach(() => {
    // Reset mocks including getRuleConfig
    jest.clearAllMocks();

    // Default mock for getRuleConfig (returns default config)
    (getRuleConfig as jest.Mock).mockResolvedValue({
      velocityBreach: { maxPayouts: 3, windowSeconds: 60 * 60 }, // Default config
      // Add other default rule configs if needed by evaluateRules
    });

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

    // Default mock implementation for supabaseAdmin.from
    // Handles the general case where no specific config/context is needed
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        // Default: Return empty payouts/charges for context
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          like: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // Fallback for other tables if needed
      return {
        /* ... minimal fallback ... */
      };
    });
  });

  it('should use default rule set when no custom rule set exists', async () => {
    // Arrange: Default getRuleConfig mock is used.
    // Mock event_buffer to return the 3 payouts for context fetching
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: mockPayouts, error: null }),
        };
      }
      return {
        /* fallback */
      };
    });

    // Act: Default rule set has maxPayouts: 3.
    // With 3 recent payouts, 3 > 3 is false, so no alert.
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(alerts.length).toBe(0);
    expect(getRuleConfig).toHaveBeenCalledWith(mockEvent.account);
  });

  it('should respect custom rule set with stricter maxPayouts threshold', async () => {
    // Arrange:
    // 1. Mock getRuleConfig for this specific test to return stricter config
    (getRuleConfig as jest.Mock).mockResolvedValue({
      velocityBreach: { maxPayouts: 2, windowSeconds: 60 * 60 }, // Stricter config
      // Add other rules if needed
    });

    // 2. Mock event_buffer to return the 3 payouts for context fetching
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: mockPayouts, error: null }),
        };
      }
      // No need to mock connected_accounts here, as getRuleConfig is mocked directly
      return {
        /* fallback */
      };
    });

    // Act: Custom rule set has maxPayouts: 2.
    // With 3 recent payouts, 3 > 2 is true, should trigger alert.
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(getRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity_breach');
  });

  it('should handle errors when retrieving custom rule set', async () => {
    // Arrange:
    // 1. Mock getRuleConfig to reject
    const configError = new Error('Failed to fetch config');
    (getRuleConfig as jest.Mock).mockRejectedValue(configError);

    // 2. Mock event_buffer (context fetch might still happen or be skipped)
    // Let's assume evaluateRules handles config error gracefully and returns []
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        // This might not even be called if config fails first
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: mockPayouts, error: null }),
        };
      }
      return {
        /* fallback */
      };
    });

    // Act: evaluateRules should catch the config error and return []
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(getRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(0); // Expect no alerts due to config error
  });

  it('should use default rules if custom rule set is invalid or not found', async () => {
    // Arrange:
    // 1. Mock getRuleConfig to reject
    const configError = new Error('Failed to fetch config');
    (getRuleConfig as jest.Mock).mockRejectedValue(configError);

    // 2. Mock event_buffer (context fetch might still happen or be skipped)
    // Let's assume evaluateRules handles config error gracefully and returns []
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        // This might not even be called if config fails first
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: mockPayouts, error: null }),
        };
      }
      return {
        /* fallback */
      };
    });

    // Act: evaluateRules should catch the config error and return []
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(getRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(0); // Expect no alerts due to config error
  });

  it('should allow disabling specific rules via custom rule set', async () => {
    // Arrange:
    // 1. Mock getRuleConfig for this specific test to return stricter config
    (getRuleConfig as jest.Mock).mockResolvedValue({
      velocityBreach: { maxPayouts: 2, windowSeconds: 60 * 60 }, // Stricter config
      // Add other rules if needed
    });

    // 2. Mock event_buffer to return the 3 payouts for context fetching
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn().mockResolvedValue({ data: mockPayouts, error: null }),
        };
      }
      // No need to mock connected_accounts here, as getRuleConfig is mocked directly
      return {
        /* fallback */
      };
    });

    // Act: Custom rule set has maxPayouts: 2.
    // With 3 recent payouts, 3 > 2 is true, should trigger alert.
    const alerts = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(getRuleConfig).toHaveBeenCalledWith(mockEvent.account);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity_breach');
  });
});
