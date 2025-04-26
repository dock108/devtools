import { test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateStripeEvent } from './utils/generators';
import { evaluateRulesEdge } from '../lib/guardian/rules/edge';

// Mock Supabase client
const mockSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        or: () => ({
          gte: () => ({
            order: () => ({
              data: [], // Default empty data
            }),
          }),
        }),
        like: () => ({
          gte: () => ({
            order: () => ({
              data: [], // Default empty data
            }),
          }),
        }),
        single: () => ({
          data: { rule_set: null }, // Default no rule set
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: () => ({
          data: { id: 'test-id' },
          error: null,
        }),
      }),
    }),
  }),
};

describe('Guardian Fraud Scenarios', () => {
  // Mock date for consistent testing
  const origDate = global.Date;
  const mockDate = new Date('2025-04-26T12:00:00Z');

  beforeAll(() => {
    // @ts-ignore
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new origDate(date);
        }
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    };
  });

  afterAll(() => {
    global.Date = origDate;
  });

  test('FAILED_CHARGE_BURST should trigger with 3+ failed charges in 5 minutes', async () => {
    // Create mock data with 3 failed charges in the last 5 minutes
    const currentTime = Date.now();
    const failedCharges = [
      {
        type: 'charge.failed',
        created_at: new Date(currentTime - 1 * 60 * 1000).toISOString(),
      },
      {
        type: 'charge.failed',
        created_at: new Date(currentTime - 2 * 60 * 1000).toISOString(),
      },
      {
        type: 'payment_intent.payment_failed',
        created_at: new Date(currentTime - 3 * 60 * 1000).toISOString(),
      },
    ];

    // Override mock Supabase to return our test data
    const testSupabase = {
      ...mockSupabase,
      from: (table) => {
        if (table === 'connected_accounts') {
          return mockSupabase.from();
        }
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                gte: () => ({
                  order: () => ({
                    data: [], // Empty payouts
                  }),
                }),
              }),
              like: () => ({
                gte: () => ({
                  order: () => ({
                    data: failedCharges, // Return mock failed charges
                  }),
                }),
              }),
              single: () => ({
                data: { rule_set: null },
              }),
            }),
          }),
        };
      },
    };

    // Create a failed charge event
    const chargeFailedEvent = generateStripeEvent('charge.failed', {
      accountId: 'acct_test123',
      metadata: { amount: 1000 },
    });

    // Evaluate rules
    const alerts = await evaluateRulesEdge(chargeFailedEvent, testSupabase);

    // Verify a FAILED_CHARGE_BURST alert was created
    expect(alerts.length).toBeGreaterThan(0);
    const failedChargeBurstAlert = alerts.find((a) => a.type === 'FAILED_CHARGE_BURST');
    expect(failedChargeBurstAlert).not.toBeUndefined();
    expect(failedChargeBurstAlert?.severity).toBe('high');
    expect(failedChargeBurstAlert?.message).toContain('Spike in failed payments');
  });

  test('SUDDEN_PAYOUT_DISABLE should trigger when payouts are disabled', async () => {
    // Create an account.updated event with payouts_enabled changing from true to false
    const payoutDisableEvent = generateStripeEvent('account.updated', {
      accountId: 'acct_test123',
      data: {
        object: {
          id: 'acct_test123',
          payouts_enabled: false,
          // ...other account fields
        },
        previous_attributes: {
          payouts_enabled: true,
        },
      },
    });

    // Evaluate rules
    const alerts = await evaluateRulesEdge(payoutDisableEvent, mockSupabase);

    // Verify a SUDDEN_PAYOUT_DISABLE alert was created
    expect(alerts.length).toBeGreaterThan(0);
    const payoutDisableAlert = alerts.find((a) => a.type === 'SUDDEN_PAYOUT_DISABLE');
    expect(payoutDisableAlert).not.toBeUndefined();
    expect(payoutDisableAlert?.severity).toBe('medium');
    expect(payoutDisableAlert?.message).toContain('Payouts disabled');
  });

  test('HIGH_RISK_REVIEW should trigger for review.opened with reason="rule"', async () => {
    // Create a review.opened event with reason="rule"
    const highRiskReviewEvent = generateStripeEvent('review.opened', {
      accountId: 'acct_test123',
      data: {
        object: {
          id: 'prv_test123',
          reason: 'rule',
          charge: 'ch_test123',
          // ...other review fields
        },
      },
    });

    // Evaluate rules
    const alerts = await evaluateRulesEdge(highRiskReviewEvent, mockSupabase);

    // Verify a HIGH_RISK_REVIEW alert was created
    expect(alerts.length).toBeGreaterThan(0);
    const highRiskAlert = alerts.find((a) => a.type === 'HIGH_RISK_REVIEW');
    expect(highRiskAlert).not.toBeUndefined();
    expect(highRiskAlert?.severity).toBe('high');
    expect(highRiskAlert?.message).toContain('Stripe flagged a high-risk charge');
  });

  test('HIGH_RISK_REVIEW should not trigger for other review reasons', async () => {
    // Create a review.opened event with a different reason
    const otherReviewEvent = generateStripeEvent('review.opened', {
      accountId: 'acct_test123',
      data: {
        object: {
          id: 'prv_test123',
          reason: 'manual', // Not 'rule'
          charge: 'ch_test123',
          // ...other review fields
        },
      },
    });

    // Evaluate rules
    const alerts = await evaluateRulesEdge(otherReviewEvent, mockSupabase);

    // Verify no HIGH_RISK_REVIEW alert was created
    const highRiskAlert = alerts.find((a) => a.type === 'HIGH_RISK_REVIEW');
    expect(highRiskAlert).toBeUndefined();
  });
});
