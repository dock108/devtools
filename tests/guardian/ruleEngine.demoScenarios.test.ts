import { evaluateRules } from '@/lib/guardian/rules';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadDemoScenarios } from '../utils/demo-scenario-loader';

// Mock supabaseAdmin to avoid actual database calls
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnValue({ error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnValue({ data: [], error: null }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Load all demo scenarios
const scenarios = loadDemoScenarios();

const expected = {
  'velocity-breach': [{ type: 'VELOCITY', severity: 'high' }],
  'bank-swap': [{ type: 'BANK_SWAP', severity: 'high' }],
  'geo-mismatch': [{ type: 'GEO_MISMATCH', severity: 'medium' }],
};

describe('Demo Scenarios', () => {
  // Mock supabase queries with actual scenario data
  beforeAll(() => {
    // Create mocks for payout events and charges with appropriate data
    const mockVelocityPayouts = scenarios['velocity-breach'].map((e) => ({
      id: e.id,
      type: e.type,
      created_at: new Date(e.created * 1000).toISOString(),
      stripe_account_id: 'acct_demo',
      amount: e.data.object.amount || 0,
      currency: e.data.object.currency || 'usd',
    }));

    const mockBankSwapPayouts = scenarios['bank-swap'].map((e) => ({
      id: e.id,
      type: e.type,
      created_at: new Date(e.created * 1000).toISOString(),
      stripe_account_id: 'acct_demo',
      amount: e.data.object.amount || 0,
      currency: e.data.object.currency || 'usd',
    }));

    const mockGeoMismatchCharges = scenarios['geo-mismatch']
      .filter((e) => e.type.startsWith('charge.'))
      .map((e) => ({
        id: e.id,
        type: e.type,
        created_at: new Date(e.created * 1000).toISOString(),
        stripe_account_id: 'acct_demo',
        amount: e.data.object.amount || 0,
        currency: e.data.object.currency || 'usd',
        event_data: {
          ...e.data.object,
          // Add geo mismatch data
          ip_country: 'NG', // Nigeria
          billing_details: { address: { country: 'US' } },
        },
      }));

    // Setup mocks for each scenario
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      const mockFrom = {
        insert: jest.fn().mockReturnValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue({ data: [], error: null }),
      };

      if (table === 'payout_events') {
        // For velocity-breach scenario
        mockFrom.select = jest.fn().mockReturnThis();
        mockFrom.eq = jest.fn().mockImplementation((column, value) => {
          if (column === 'stripe_account_id' && value === 'acct_demo') {
            return mockFrom;
          }
          return mockFrom;
        });
        mockFrom.or = jest.fn().mockReturnThis();
        mockFrom.gte = jest.fn().mockReturnThis();
        mockFrom.like = jest.fn().mockImplementation((column, value) => {
          if (column === 'type' && value === 'charge.%') {
            // For geo-mismatch, return charges
            return {
              gte: () => ({
                order: () => ({ data: mockGeoMismatchCharges, error: null }),
              }),
            };
          }
          return mockFrom;
        });
        mockFrom.order = jest.fn().mockImplementation(() => {
          // Check the current test case
          if (currentTestCase === 'velocity-breach') {
            return { data: mockVelocityPayouts, error: null };
          } else if (currentTestCase === 'bank-swap') {
            return { data: mockBankSwapPayouts, error: null };
          } else {
            return { data: [], error: null };
          }
        });
      }

      return mockFrom;
    });
  });

  // Variable to track current test case
  let currentTestCase = '';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear mocked database for next test
    await supabaseAdmin.rpc('truncate_table', { table: 'payout_events' });
  });

  // Test each scenario
  for (const [name, events] of Object.entries(scenarios)) {
    it(`emits correct alerts for ${name}`, async () => {
      currentTestCase = name;
      const alerts = [];

      for (const event of events) {
        // Mock inserting each event
        await supabaseAdmin.from('payout_events').insert({
          stripe_event_id: event.id,
          stripe_payout_id: event.data.object.id || event.id,
          stripe_account_id: 'acct_demo',
          type: event.type,
          amount: event.data.object.amount || 0,
          currency: event.data.object.currency || 'usd',
          event_data: event.data.object,
          created_at: new Date(event.created * 1000).toISOString(),
        });

        // Call the actual rule engine
        const ruleAlerts = await evaluateRules(event);
        alerts.push(...ruleAlerts);
      }

      // Only compare the last alert (end result) with expected
      const finalAlerts = alerts.length > 0 ? [alerts[alerts.length - 1]] : [];

      // Extract just the type and severity for comparison
      const simplifiedAlerts = finalAlerts.map((a) => ({
        type: a.type,
        severity: a.severity,
      }));

      // Check if we got the expected alert
      expect(simplifiedAlerts).toEqual(expected[name]);
    });
  }
});
