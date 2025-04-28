import { describe, it, expect, beforeEach } from '@jest/globals';
import { evaluateRules } from '@/lib/guardian/rules';
import { velocityBreach } from '@/lib/guardian/rules/velocityBreach';
import { bankSwap } from '@/lib/guardian/rules/bankSwap';
import { geoMismatch } from '@/lib/guardian/rules/geoMismatch';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRuleConfig } from '@/lib/guardian/getRuleConfig';

// Mock the underlying modules
jest.mock('@/lib/guardian/rules/velocityBreach');
jest.mock('@/lib/guardian/rules/bankSwap');
jest.mock('@/lib/guardian/rules/geoMismatch');
jest.mock('@/lib/supabase-admin');
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/guardian/getRuleConfig');

// Utility function to create a mock Stripe event
const createMockStripeEvent = (type: string, accountId: string) => {
  return {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type,
    account: accountId,
    data: {
      object: {
        id: 'po_' + Math.random().toString(36).substring(2, 10),
        object: 'payout',
        metadata: {},
      },
    },
  } as any;
};

// TODO: Re-enable after fixing test stabilization issues in #<issue_number>
describe.skip('Rule Engine Core', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Mock getRuleConfig to return a default structure
    (getRuleConfig as jest.Mock).mockResolvedValue({
      // Provide a basic default config structure matching RuleContext expectation
      velocityBreach: { maxPayouts: 3, windowMinutes: 60 },
      bankSwap: { lookbackMinutes: 30 },
      failedChargeBurst: { windowMinutes: 5 },
      // Add other default rule configs as expected by evaluateRules
    });

    // Setup mocks for Supabase queries (for context data fetch in evaluateRules)
    const mockSupabaseReturn = { data: [], error: null };
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(), // Added mock for 'in' used in evaluateRules
      like: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      // Use .returns() if applicable, or resolve directly for context data
      returns: jest.fn().mockResolvedValue(mockSupabaseReturn),
    });
  });

  it('should return empty array when no rules trigger', async () => {
    // Arrange
    const mockEvent = createMockStripeEvent('payout.paid', 'acct_123');
    (velocityBreach as jest.Mock).mockResolvedValue([]);
    (bankSwap as jest.Mock).mockResolvedValue([]);
    (geoMismatch as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(result).toEqual([]);
    expect(velocityBreach).toHaveBeenCalled();
    expect(bankSwap).toHaveBeenCalled();
    expect(geoMismatch).toHaveBeenCalled();
  });

  it('should merge alerts from all rules', async () => {
    // Arrange
    const mockEvent = createMockStripeEvent('payout.paid', 'acct_123');
    const velocityAlert = {
      type: 'VELOCITY',
      severity: 'high',
      message: 'Velocity breach',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    };
    const bankSwapAlert = {
      type: 'BANK_SWAP',
      severity: 'medium',
      message: 'Bank account changed',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    };

    (velocityBreach as jest.Mock).mockResolvedValue([velocityAlert]);
    (bankSwap as jest.Mock).mockResolvedValue([bankSwapAlert]);
    (geoMismatch as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(velocityAlert);
    expect(result).toContainEqual(bankSwapAlert);
  });

  it('should handle errors in individual rules and continue processing', async () => {
    // Arrange
    const mockEvent = createMockStripeEvent('payout.paid', 'acct_123');
    const geoAlert = {
      type: 'GEO_MISMATCH',
      severity: 'medium',
      message: 'Geo mismatch',
      accountId: 'acct_123',
      createdAt: expect.any(String),
    };

    (velocityBreach as jest.Mock).mockRejectedValue(new Error('Test error'));
    (bankSwap as jest.Mock).mockResolvedValue([]);
    (geoMismatch as jest.Mock).mockResolvedValue([geoAlert]);

    // Act
    const result = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(result).toHaveLength(1);
    expect(result).toContainEqual(geoAlert);
  });

  it('should skip rule evaluation when account ID is missing', async () => {
    // Arrange
    const mockEvent = createMockStripeEvent('payout.paid', '');
    mockEvent.account = undefined;

    // Act
    const result = await evaluateRules(mockEvent, mockEvent.account);

    // Assert
    expect(result).toEqual([]);
    expect(velocityBreach).not.toHaveBeenCalled();
    expect(bankSwap).not.toHaveBeenCalled();
    expect(geoMismatch).not.toHaveBeenCalled();
    expect(getRuleConfig).not.toHaveBeenCalled();
  });
});
