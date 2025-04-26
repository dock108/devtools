import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { evaluateRulesEdge } from '../lib/guardian/rules/edge'; // Adjust path as needed
import { getRuleConfig, clearRuleConfigCache } from '../lib/guardian/getRuleConfig'; // Adjust path
import type { StripeEvent } from '../lib/guardian/types';

// Test environment (use local Supabase)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.vI9obAHOGyVVKa3pD--kJlyxp-Z2zV9UUMAhKpNLAcU';

// Skip tests if no Supabase connection is available
const skipTests = !SUPABASE_URL || !SUPABASE_SERVICE_KEY;

describe('Guardian Rule Set Overrides', () => {
  if (skipTests) {
    test.skip('Skipping rule set tests - Supabase connection details missing', () => {});
    return;
  }

  let supabase: SupabaseClient;
  const testAccountId = `acct_ruleset_${Date.now().toString(36)}`;
  let defaultRuleSetId: string;
  let customRuleSetId: string;

  const customRuleSetConfig = {
    // Stricter velocity rule
    velocityBreach: { maxPayouts: 2, windowSeconds: 30 },
    // Keep others same as default for this test
    bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
    geoMismatch: { mismatchChargeCount: 2 },
    failedChargeBurst: { minFailedCount: 3, windowMinutes: 5 },
    suddenPayoutDisable: { enabled: true },
    highRiskReview: { enabled: true },
  };

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Ensure migrations ran (rule_sets table exists)
    // Get default rule set ID with retry
    let defaultSet: { id: string } | null = null;
    let attempts = 0;
    while (!defaultSet && attempts < 5) {
      const { data } = await supabase
        .from('rule_sets')
        .select('id')
        .eq('name', 'default')
        .maybeSingle();
      defaultSet = data;
      if (!defaultSet) {
        attempts++;
        console.log(`Retrying to fetch default rule set (attempt ${attempts})...`);
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before retry
      }
    }

    expect(defaultSet).toBeTruthy();
    if (!defaultSet) {
      throw new Error('Failed to fetch default rule set after multiple attempts.');
    }
    defaultRuleSetId = defaultSet.id;

    // Insert custom rule set for testing
    const { data: customSet, error: customError } = await supabase
      .from('rule_sets')
      .insert({ name: `test-custom-${testAccountId}`, config: customRuleSetConfig })
      .select('id')
      .single();
    expect(customError).toBeNull();
    expect(customSet).toBeTruthy();
    customRuleSetId = customSet!.id;

    // Insert test connected account (initially using default)
    const { error: accountError } = await supabase.from('connected_accounts').insert({
      stripe_account_id: testAccountId,
      rule_set_id: defaultRuleSetId,
      email: 'test@example.com',
    });
    expect(accountError).toBeNull();
  });

  beforeEach(() => {
    // Clear cache before each test to ensure DB is hit when expected
    clearRuleConfigCache();
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('connected_accounts').delete().eq('stripe_account_id', testAccountId);
    await supabase.from('rule_sets').delete().eq('id', customRuleSetId);
    // Clear any test events from event_buffer
    await supabase.from('event_buffer').delete().eq('stripe_account_id', testAccountId);
  });

  // Helper to create a simple payout event
  const createPayoutEvent = (idSuffix: string, timestamp: number): Partial<StripeEvent> => ({
    id: `evt_po_${idSuffix}`,
    account: testAccountId,
    type: 'payout.created', // Or payout.paid
    data: { object: { id: `po_${idSuffix}`, amount: 5000, currency: 'usd' } },
    created: timestamp,
  });

  // Helper to insert events into buffer
  const seedEvents = async (events: Partial<StripeEvent>[]) => {
    const bufferEntries = events.map((evt, i) => ({
      id: uuidv4(),
      stripe_event_id: evt.id,
      stripe_account_id: testAccountId,
      type: evt.type,
      payload: evt,
      received_at: new Date(evt.created! * 1000).toISOString(),
    }));
    const { error } = await supabase.from('event_buffer').insert(bufferEntries);
    expect(error).toBeNull();
  };

  test('should use default ruleset (3 payouts) when account uses default', async () => {
    const now = Date.now();
    const events = [
      createPayoutEvent('a1', now / 1000 - 10), // 10s ago
      createPayoutEvent('a2', now / 1000 - 5), // 5s ago
    ];
    await seedEvents(events);

    const triggerEvent = createPayoutEvent('a3_trigger', now / 1000) as StripeEvent;
    const config = await getRuleConfig(testAccountId); // Should get default
    const alerts = await evaluateRulesEdge(triggerEvent, supabase, config);

    // Expect NO alert, because default threshold is 3
    const velocityAlert = alerts.find((a) => a.type === 'VELOCITY');
    expect(velocityAlert).toBeUndefined();
  });

  test('should use custom ruleset (2 payouts) when account linked to it', async () => {
    // Link account to custom rule set
    const { error: updateError } = await supabase
      .from('connected_accounts')
      .update({ rule_set_id: customRuleSetId })
      .eq('stripe_account_id', testAccountId);
    expect(updateError).toBeNull();
    clearRuleConfigCache(); // Ensure config is re-fetched

    const now = Date.now();
    const events = [
      createPayoutEvent('b1', now / 1000 - 10), // 10s ago
    ];
    await seedEvents(events);

    const triggerEvent = createPayoutEvent('b2_trigger', now / 1000) as StripeEvent;
    const config = await getRuleConfig(testAccountId); // Should get custom
    expect(config?.velocityBreach?.maxPayouts).toBe(2); // Verify correct config loaded

    const alerts = await evaluateRulesEdge(triggerEvent, supabase, config);

    // Expect VELOCITY alert, because custom threshold is 2
    const velocityAlert = alerts.find((a) => a.type === 'VELOCITY');
    expect(velocityAlert).toBeDefined();
    expect(velocityAlert?.message).toContain('2 payouts inside 30s');
  });

  test('should revert to default ruleset when custom link is removed', async () => {
    // Link account to custom rule set first (as in previous test)
    await supabase
      .from('connected_accounts')
      .update({ rule_set_id: customRuleSetId })
      .eq('stripe_account_id', testAccountId);
    clearRuleConfigCache();
    const customConfig = await getRuleConfig(testAccountId);
    expect(customConfig?.velocityBreach?.maxPayouts).toBe(2);

    // Now, unlink the custom set (set back to default or null)
    const { error: updateError } = await supabase
      .from('connected_accounts')
      .update({ rule_set_id: defaultRuleSetId })
      .eq('stripe_account_id', testAccountId);
    expect(updateError).toBeNull();
    clearRuleConfigCache(); // Ensure config is re-fetched

    const now = Date.now();
    const events = [
      createPayoutEvent('c1', now / 1000 - 10), // 10s ago
    ];
    await seedEvents(events);

    const triggerEvent = createPayoutEvent('c2_trigger', now / 1000) as StripeEvent;
    const config = await getRuleConfig(testAccountId); // Should get default again
    expect(config?.velocityBreach?.maxPayouts).toBe(3); // Verify default config loaded

    const alerts = await evaluateRulesEdge(triggerEvent, supabase, config);

    // Expect NO alert, because default threshold (3) is not met by 2 payouts
    const velocityAlert = alerts.find((a) => a.type === 'VELOCITY');
    expect(velocityAlert).toBeUndefined();
  });
});
