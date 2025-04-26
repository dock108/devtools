import { test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import { generateStripeEvent } from './utils/generators';

// Test environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Guardian Reactor tests', () => {
  let supabase: SupabaseClient;
  let testStripeAccountId: string;
  let insertedEventId: string;

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    testStripeAccountId = `acct_${faker.string.alphanumeric(14)}`;
  });

  afterAll(async () => {
    // Clean up any test data
    await supabase.from('processed_events').delete().eq('stripe_account_id', testStripeAccountId);

    await supabase.from('event_buffer').delete().eq('stripe_account_id', testStripeAccountId);

    await supabase.from('alerts').delete().eq('stripe_account_id', testStripeAccountId);
  });

  beforeEach(async () => {
    // Reset any existing test data
    await supabase.from('processed_events').delete().eq('stripe_account_id', testStripeAccountId);

    await supabase.from('alerts').delete().eq('stripe_account_id', testStripeAccountId);
  });

  test('Should process a valid event and mark it as processed', async () => {
    // Insert a test event to the buffer
    const chargeFailedEvent = generateStripeEvent('charge.failed', {
      accountId: testStripeAccountId,
      metadata: { amount: 5000 },
    });

    const { data: insertedEvent, error: insertError } = await supabase
      .from('event_buffer')
      .insert({
        stripe_event_id: chargeFailedEvent.id,
        stripe_account_id: testStripeAccountId,
        type: chargeFailedEvent.type,
        received_at: new Date().toISOString(),
        data: chargeFailedEvent,
      })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(insertedEvent).not.toBeNull();
    insertedEventId = insertedEvent!.id;

    // Invoke the guardian-reactor function
    const { data, error } = await supabase.functions.invoke('guardian-reactor', {
      body: JSON.stringify({ event_buffer_id: insertedEventId }),
    });

    expect(error).toBeNull();

    // Verify the event was processed
    const { data: processedEvent, error: processError } = await supabase
      .from('processed_events')
      .select('*')
      .eq('stripe_event_id', chargeFailedEvent.id)
      .single();

    expect(processError).toBeNull();
    expect(processedEvent).not.toBeNull();
    expect(processedEvent!.stripe_account_id).toBe(testStripeAccountId);
    expect(processedEvent!.process_duration_ms).toBeGreaterThan(0);
  });

  test('Should ensure idempotency by not processing the same event twice', async () => {
    // Insert a test event to the buffer
    const chargeSucceededEvent = generateStripeEvent('charge.succeeded', {
      accountId: testStripeAccountId,
      metadata: { amount: 2000 },
    });

    const { data: insertedEvent, error: insertError } = await supabase
      .from('event_buffer')
      .insert({
        stripe_event_id: chargeSucceededEvent.id,
        stripe_account_id: testStripeAccountId,
        type: chargeSucceededEvent.type,
        received_at: new Date().toISOString(),
        data: chargeSucceededEvent,
      })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(insertedEvent).not.toBeNull();
    insertedEventId = insertedEvent!.id;

    // Mark the event as already processed
    await supabase.from('processed_events').insert({
      stripe_event_id: chargeSucceededEvent.id,
      stripe_account_id: testStripeAccountId,
      processed_at: new Date().toISOString(),
      process_duration_ms: 100,
      alerts_created: 0,
    });

    // Invoke the guardian-reactor function again
    const { data, error } = await supabase.functions.invoke('guardian-reactor', {
      body: JSON.stringify({ event_buffer_id: insertedEventId }),
    });

    expect(error).toBeNull();
    expect(data.skipped).toBe(true);

    // Verify there's only one processed event record
    const { data: processedEvents, error: countError } = await supabase
      .from('processed_events')
      .select('*', { count: 'exact' })
      .eq('stripe_event_id', chargeSucceededEvent.id);

    expect(countError).toBeNull();
    expect(processedEvents!.length).toBe(1);
  });

  test('Should create alerts when rules are triggered', async () => {
    // Insert a suspicious event that should trigger an alert
    // (Assuming we have a rule that triggers on high-value charge.failed events)
    const suspiciousEvent = generateStripeEvent('charge.failed', {
      accountId: testStripeAccountId,
      metadata: { amount: 99999 }, // Very high amount to trigger rules
    });

    const { data: insertedEvent, error: insertError } = await supabase
      .from('event_buffer')
      .insert({
        stripe_event_id: suspiciousEvent.id,
        stripe_account_id: testStripeAccountId,
        type: suspiciousEvent.type,
        received_at: new Date().toISOString(),
        data: suspiciousEvent,
      })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(insertedEvent).not.toBeNull();
    insertedEventId = insertedEvent!.id;

    // Invoke the guardian-reactor function
    const { data, error } = await supabase.functions.invoke('guardian-reactor', {
      body: JSON.stringify({ event_buffer_id: insertedEventId }),
    });

    expect(error).toBeNull();

    // Verify an alert was created
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('event_ref', suspiciousEvent.id);

    expect(alertsError).toBeNull();
    expect(alerts!.length).toBeGreaterThan(0);

    // Verify the processed_events record shows the correct alert count
    const { data: processedEvent, error: processError } = await supabase
      .from('processed_events')
      .select('*')
      .eq('stripe_event_id', suspiciousEvent.id)
      .single();

    expect(processError).toBeNull();
    expect(processedEvent!.alerts_created).toBe(alerts!.length);
  });

  test('Should handle malformed input correctly', async () => {
    // Test with invalid event_buffer_id
    const { data, error } = await supabase.functions.invoke('guardian-reactor', {
      body: JSON.stringify({ event_buffer_id: 'non-existent-id' }),
    });

    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // Test with missing event_buffer_id
    const { data: data2, error: error2 } = await supabase.functions.invoke('guardian-reactor', {
      body: JSON.stringify({ some_other_field: 'value' }),
    });

    expect(error2).not.toBeNull();
    expect(data2).toBeNull();
  });
});
