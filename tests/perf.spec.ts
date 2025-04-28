import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { evaluateRulesEdge } from '../lib/guardian/rules/edge';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Test environment
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if no Supabase connection is available
const skipTests = !SUPABASE_URL || !SUPABASE_SERVICE_KEY;

// Add a warning if the service key is missing
if (!SUPABASE_SERVICE_KEY) {
  console.warn(
    '[tests/perf.spec.ts] WARNING: SUPABASE_SERVICE_ROLE_KEY env var not set. Performance tests requiring it will be skipped.',
  );
}

describe('Guardian performance tests', () => {
  // Only run these tests in a CI environment or with explicit opt-in
  const shouldRun = process.env.CI === 'true' || process.env.RUN_PERF_TESTS === 'true';

  if (skipTests || !shouldRun) {
    test.skip('Skipping performance tests', () => {
      console.log('Skipping performance tests - set RUN_PERF_TESTS=true to run locally');
    });
    return;
  }

  let supabase;
  let testAccountId;
  const EVENT_COUNT = 5000;

  beforeAll(async () => {
    // Create Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Generate unique test account ID for this test run
    testAccountId = `acct_perf_test_${Date.now().toString(36)}`;

    // Generate batch of test events
    const testEvents = [];
    const baseTime = Date.now();

    // Create events in batch of 1000 to avoid memory issues
    for (let i = 0; i < EVENT_COUNT; i++) {
      // Create a mix of different event types
      const eventType =
        i % 10 === 0 ? 'payout.created' : i % 5 === 0 ? 'charge.failed' : 'charge.succeeded';

      testEvents.push({
        id: uuidv4(),
        stripe_account_id: testAccountId,
        stripe_event_id: `evt_perf_${i}`,
        type: eventType,
        received_at: new Date(baseTime - i * 1000).toISOString(), // Events spread over time
        payload: {
          id: `evt_perf_${i}`,
          account: testAccountId,
          type: eventType,
          data: {
            object: {
              id: `obj_${i}`,
              amount: 1000,
              currency: 'usd',
            },
          },
          created: Math.floor(baseTime / 1000) - i,
        },
      });

      // Insert in batches of 1000
      if (testEvents.length === 1000 || i === EVENT_COUNT - 1) {
        await supabase.from('event_buffer').insert(testEvents);
        console.log(`Inserted batch of ${testEvents.length} events`);
        testEvents.length = 0; // Clear array for next batch
      }
    }

    // Verify events were inserted
    const { count } = await supabase
      .from('event_buffer')
      .select('*', { count: 'exact', head: true })
      .eq('stripe_account_id', testAccountId);

    console.log(`Test setup complete: ${count} events inserted for ${testAccountId}`);
  }, 60000); // Allow up to 1 minute for test setup

  afterAll(async () => {
    // Clean up test data
    if (testAccountId) {
      console.log(`Cleaning up test data for ${testAccountId}`);
      await supabase.from('event_buffer').delete().eq('stripe_account_id', testAccountId);
    }
  }, 30000);

  test('velocity rule evaluation should be fast (< 50ms)', async () => {
    // Create a sample payout event for triggering velocity rule
    const testEvent = {
      id: 'evt_perf_test_payout',
      type: 'payout.created',
      account: testAccountId,
      data: {
        object: {
          id: 'po_perf_test',
          amount: 5000,
          currency: 'usd',
        },
      },
      created: Math.floor(Date.now() / 1000),
    };

    // Warm-up run to prime any caches
    await evaluateRulesEdge(testEvent, supabase);

    // Timed evaluation run
    const startTime = performance.now();
    const alerts = await evaluateRulesEdge(testEvent, supabase);
    const duration = performance.now() - startTime;

    console.log(`Rule evaluation took ${Math.round(duration)}ms`);

    // Expect evaluation to complete in under 50ms
    expect(duration).toBeLessThan(50);

    // Additional assertions about the results
    expect(Array.isArray(alerts)).toBe(true);
  }, 10000);

  test('should efficiently process recent charge events (< 50ms)', async () => {
    // Create a sample failed charge event
    const testEvent = {
      id: 'evt_perf_test_charge',
      type: 'charge.failed',
      account: testAccountId,
      data: {
        object: {
          id: 'ch_perf_test',
          amount: 2000,
          currency: 'usd',
        },
      },
      created: Math.floor(Date.now() / 1000),
    };

    // Timed evaluation run
    const startTime = performance.now();
    const alerts = await evaluateRulesEdge(testEvent, supabase);
    const duration = performance.now() - startTime;

    console.log(`Charge rule evaluation took ${Math.round(duration)}ms`);

    // Expect evaluation to complete in under 50ms
    expect(duration).toBeLessThan(50);

    // Additional assertions about the results
    expect(Array.isArray(alerts)).toBe(true);
  }, 10000);
});
