import { evaluateEvent } from '../lib/guardian/rules';
import type { GuardianEventRow } from '../types/supabase';

describe('evaluateEvent Rules', () => {
  const baseTime = Date.now();
  const mockEvent = (overrides: Partial<GuardianEventRow>): GuardianEventRow => ({
    id: `evt_${Math.random().toString(36).substring(7)}`,
    type: 'payout.paid',
    account: 'acct_test',
    amount: 2000,
    currency: 'usd',
    event_time: new Date(baseTime).toISOString(),
    raw: {},
    flagged: false,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  test('should not flag a single payout', () => {
    const event = mockEvent({});
    expect(evaluateEvent(event, [])).toEqual({ flagged: false });
  });

  test('should not flag below velocity limit (3 payouts in 60s)', () => {
    const history = [
      mockEvent({ event_time: new Date(baseTime - 10_000).toISOString() }),
      mockEvent({ event_time: new Date(baseTime - 20_000).toISOString() }),
    ];
    const event = mockEvent({}); // 3rd payout
    expect(evaluateEvent(event, history)).toEqual({ flagged: false });
  });

  test('should flag velocity breach at 4 payouts in 60s', () => {
    const history = [
      mockEvent({ event_time: new Date(baseTime - 10_000).toISOString() }),
      mockEvent({ event_time: new Date(baseTime - 20_000).toISOString() }),
      mockEvent({ event_time: new Date(baseTime - 30_000).toISOString() }),
    ];
    const event = mockEvent({}); // 4th payout
    expect(evaluateEvent(event, history)).toEqual({
      flagged: true,
      reason: 'velocity',
      breachCount: 4,
    });
  });

  test('should not flag velocity breach if payouts are outside window', () => {
    const history = [
      mockEvent({ event_time: new Date(baseTime - 70_000).toISOString() }),
      mockEvent({ event_time: new Date(baseTime - 80_000).toISOString() }),
      mockEvent({ event_time: new Date(baseTime - 90_000).toISOString() }),
    ];
    const event = mockEvent({}); // 1st recent payout, 3 old ones
    expect(evaluateEvent(event, history)).toEqual({ flagged: false });
  });

  test('should flag bank swap on account.updated with previous external_accounts', () => {
    const event = mockEvent({
      type: 'account.updated',
      amount: null,
      raw: {
        data: {
          previous_attributes: { external_accounts: { data: [{ id: 'ba_old' }] } },
        },
      },
    });
    expect(evaluateEvent(event, [])).toEqual({
      flagged: true,
      reason: 'bank_swap',
    });
  });

  test('should not flag account.updated without previous external_accounts', () => {
    const event = mockEvent({
      type: 'account.updated',
      amount: null,
      raw: { data: { previous_attributes: { email: 'old@example.com' } } }, // No external_accounts
    });
    expect(evaluateEvent(event, [])).toEqual({ flagged: false });
  });

    test('should not flag account.updated with null raw data', () => {
    const event = mockEvent({
      type: 'account.updated',
      amount: null,
      raw: null, 
    });
    expect(evaluateEvent(event, [])).toEqual({ flagged: false });
  });
}); 