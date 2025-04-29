import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { geoMismatch } from '@/lib/guardian/rules/geoMismatch';
import { logger } from '@/lib/logger';
import { RuleContext } from '@/lib/guardian/rules/index';
import { AlertType, Severity } from '@/lib/guardian/constants';
import { Tables } from '@/types/supabase'; // Import Tables type

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Mock the rule-specific dependencies
// const mockGetPayouts = jest.fn();
// const mockGetCharges = jest.fn();

describe('Geo Mismatch Rule', () => {
  const { logger: mockLogger } = require('@/lib/logger');

  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  // Helper to create mock Stripe payout event (Input event)
  const createStripePayoutEvent = (
    destination: any = { bank_account: { country: 'US' } },
    currency = 'usd',
  ) => ({
    id: 'evt_payout_123',
    type: 'payout.created',
    account: 'acct_123',
    data: {
      object: {
        id: 'po_123',
        object: 'payout',
        amount: 500000, // $5000
        currency,
        destination,
      },
    },
  });

  // Helper to create mock Charge objects (representing event_buffer entries)
  // Needs to match structure expected by the rule's parsing logic
  const createMockCharge = (
    id: string,
    countryCode: string | null,
    timestamp: Date,
  ): Partial<Tables<'event_buffer'>> => ({
    id: `evt_ch_${id}`,
    type: 'charge.succeeded', // Assuming rule looks at succeeded charges
    received_at: timestamp.toISOString(),
    stripe_account_id: 'acct_123',
    // Simulate the nested payload structure - **DO NOT STRINGIFY**
    payload: countryCode
      ? {
          // Example structure - adjust if rule parses differently!
          payment_method_details: {
            card: {
              country: countryCode,
            },
          },
          // OR potentially charge.source.card.country depending on charge type
        }
      : { payment_method_details: { card: {} } }, // No country
  });

  it('should return empty array for non-payout events', async () => {
    const event = { type: 'charge.succeeded', account: 'acct_123', data: { object: {} } };
    const ctx = { recentCharges: [], config: {} }; // Provide empty charges

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should not trigger alert when charge countries match bank country', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'US', new Date(now.getTime() - 10000)),
      createMockCharge('2', 'US', new Date(now.getTime() - 20000)),
      createMockCharge('3', 'US', new Date(now.getTime() - 30000)),
    ];
    const event = createStripePayoutEvent({ bank_account: { country: 'US' } }); // Bank is US
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US',
        chargeCountries: ['US'], // Only US charges
        mismatchCount: 0, // No mismatches
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
  });

  it('should not trigger alert when mismatches are below threshold', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'US', new Date(now.getTime() - 10000)),
      createMockCharge('2', 'CA', new Date(now.getTime() - 20000)), // 1 mismatch (CA)
      createMockCharge('3', 'US', new Date(now.getTime() - 30000)),
    ];
    const event = createStripePayoutEvent({ bank_account: { country: 'US' } }); // Bank is US
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } }, // Threshold 2
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US',
        chargeCountries: ['US', 'CA'], // US and CA charges
        mismatchCount: 1, // 1 mismatch (CA)
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
  });

  it('should trigger alert when mismatches meet or exceed threshold', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'CA', new Date(now.getTime() - 10000)), // Mismatch 1 (CA)
      createMockCharge('2', 'GB', new Date(now.getTime() - 20000)), // Mismatch 2 (GB)
      createMockCharge('3', 'US', new Date(now.getTime() - 30000)), // Match
    ];
    const event = createStripePayoutEvent({ bank_account: { country: 'US' } }); // Bank is US
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } }, // Threshold 2
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    // Update Alert expectation
    expect(result[0]).toEqual({
      alertType: AlertType.GeoMismatch,
      severity: Severity.Medium,
      message:
        'Potential geo-mismatch: 2 recent charge(s) from countries (CA, GB, US) differ from payout bank country (US).',
      accountId: 'acct_123',
      payoutId: 'po_123',
      createdAt: expect.any(String),
    });
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US',
        chargeCountries: ['CA', 'GB', 'US'], // CA, GB, US charges
        mismatchCount: 2, // 2 mismatches (CA, GB)
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
  });

  it('should handle charges with missing country info gracefully', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'CA', new Date(now.getTime() - 10000)), // Mismatch 1 (CA)
      createMockCharge('2', null, new Date(now.getTime() - 20000)), // Missing country
      createMockCharge('3', 'GB', new Date(now.getTime() - 30000)), // Mismatch 2 (GB)
      createMockCharge('4', 'US', new Date(now.getTime() - 40000)), // Match
    ];
    const event = createStripePayoutEvent({ bank_account: { country: 'US' } }); // Bank is US
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } }, // Threshold 2
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    // Update Alert expectation
    expect(result[0]).toEqual({
      alertType: AlertType.GeoMismatch,
      severity: Severity.Medium,
      message:
        'Potential geo-mismatch: 2 recent charge(s) from countries (CA, GB, US) differ from payout bank country (US).',
      accountId: 'acct_123',
      payoutId: 'po_123',
      createdAt: expect.any(String),
    });
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US',
        chargeCountries: ['CA', 'GB', 'US'], // Charge with null country ignored
        mismatchCount: 2, // 2 mismatches (CA, GB)
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
  });

  it('should handle payout with missing bank country gracefully', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'CA', new Date(now.getTime() - 10000)),
      createMockCharge('2', 'GB', new Date(now.getTime() - 20000)),
    ];
    // Payout destination is just an ID string, no bank_account object
    const event = createStripePayoutEvent('ba_12345', 'usd');
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } },
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    // Update Alert expectation
    expect(result[0]).toEqual({
      alertType: AlertType.GeoMismatch,
      severity: Severity.Medium,
      message:
        'Potential geo-mismatch: 2 recent charge(s) from countries (CA, GB) differ from payout bank country (US).',
      accountId: 'acct_123',
      payoutId: 'po_123',
      createdAt: expect.any(String),
    });
    // Ensure Logger info expectation has correct details for this case
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US', // Fallback from 'usd' currency
        chargeCountries: ['CA', 'GB'],
        mismatchCount: 2, // Both CA and GB mismatch US
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
    expect(mockLogger.warn).not.toHaveBeenCalled(); // Verify warn was NOT called
  });

  it('should use currency code as bank country fallback', async () => {
    const now = new Date();
    const mockCharges = [
      createMockCharge('1', 'CA', new Date(now.getTime() - 10000)), // Mismatch 1 (CA vs GB)
      createMockCharge('2', 'IE', new Date(now.getTime() - 20000)), // Mismatch 2 (IE vs GB)
      createMockCharge('3', 'GB', new Date(now.getTime() - 30000)), // Match
    ];
    // Payout destination is null, currency is gbp
    const event = createStripePayoutEvent(null, 'gbp');
    const ctx = {
      recentCharges: mockCharges, // Pass mock charges
      config: { geoMismatch: { mismatchChargeCount: 2 } }, // Threshold 2
    };

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toHaveLength(1);
    // Update Alert expectation
    expect(result[0]).toEqual({
      alertType: AlertType.GeoMismatch,
      severity: Severity.Medium,
      message:
        'Potential geo-mismatch: 2 recent charge(s) from countries (CA, IE, GB) differ from payout bank country (GB).',
      accountId: 'acct_123',
      payoutId: 'po_123',
      createdAt: expect.any(String),
    });
    // Update Logger expectation
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'GB', // Fallback from 'gbp' currency
        chargeCountries: ['CA', 'IE', 'GB'],
        mismatchCount: 2, // CA, IE mismatch GB
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
  });

  it('should return empty array if recentCharges is missing in context', async () => {
    const event = createStripePayoutEvent({ bank_account: { country: 'US' } });
    const ctx = { config: { geoMismatch: { mismatchChargeCount: 2 } } }; // No recentCharges

    const result = await geoMismatch(event as any, ctx as any);
    expect(result).toEqual([]);
    // Update Logger expectation (rule should still log info)
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        accountId: 'acct_123',
        payoutId: 'po_123',
        bankCountry: 'US',
        chargeCountries: [], // No charges processed
        mismatchCount: 0,
        threshold: 2,
      },
      'Geo-mismatch rule executed',
    );
    // Verify the specific warning for missing charges was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { accountId: 'acct_123', payoutId: 'po_123' },
      'Recent charges data missing or invalid in context for geo-mismatch rule.',
    );
  });
});
