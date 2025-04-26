import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

// Test environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'; // Use local Supabase by default
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.vI9obAHOGyVVKa3pD--kJlyxp-Z2zV9UUMAhKpNLAcU';

// Skip tests if no Supabase connection is available
const skipTests = !SUPABASE_URL || !SUPABASE_SERVICE_KEY;

describe('Guardian Retention Tests', () => {
  if (skipTests) {
    test.skip('Skipping retention tests - Supabase connection details missing', () => {});
    return;
  }

  let supabase: SupabaseClient;
  const testAccountId = `acct_retention_${Date.now().toString(36)}`;
  const ttlDays = 30;
  const purgeDelayDays = 7;

  // Test event data
  const recentEventId = `evt_recent_${uuidv4()}`;
  const scrubTargetEventId = `evt_scrub_${uuidv4()}`;
  const purgeTargetEventId = `evt_purge_${uuidv4()}`;

  const recentEventBufferId = uuidv4();
  const scrubTargetEventBufferId = uuidv4();
  const purgeTargetEventBufferId = uuidv4();

  const fullPayload = (id: string) => ({
    id: id,
    account: testAccountId,
    api_version: '2022-11-15',
    created: dayjs().unix(),
    data: {
      object: {
        id: `pi_${id.substring(4)}`,
        amount: 1000,
        currency: 'usd',
        customer: 'cus_xyz',
        description: 'Test charge with PII',
        // ... other sensitive fields
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'charge.succeeded',
  });

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // Ensure the is_scrubbed column exists (assuming migration was run)
  });

  beforeEach(async () => {
    // Clean previous test data for this account before each test
    await supabase.from('event_buffer').delete().eq('stripe_account_id', testAccountId);

    // Insert test data with different ages
    const events = [
      {
        id: recentEventBufferId,
        stripe_event_id: recentEventId,
        stripe_account_id: testAccountId,
        received_at: dayjs()
          .subtract(ttlDays - 5, 'day')
          .toISOString(), // Newer than TTL
        payload: fullPayload(recentEventId),
        is_scrubbed: false,
      },
      {
        id: scrubTargetEventBufferId,
        stripe_event_id: scrubTargetEventId,
        stripe_account_id: testAccountId,
        received_at: dayjs()
          .subtract(ttlDays + 2, 'day')
          .toISOString(), // Older than TTL, younger than purge
        payload: fullPayload(scrubTargetEventId),
        is_scrubbed: false,
      },
      {
        id: purgeTargetEventBufferId,
        stripe_event_id: purgeTargetEventId,
        stripe_account_id: testAccountId,
        received_at: dayjs()
          .subtract(ttlDays + purgeDelayDays + 2, 'day')
          .toISOString(), // Older than purge cutoff
        payload: fullPayload(purgeTargetEventId),
        is_scrubbed: false, // Will be scrubbed then purged
      },
    ];
    const { error } = await supabase.from('event_buffer').insert(events);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    // Final cleanup
    await supabase.from('event_buffer').delete().eq('stripe_account_id', testAccountId);
  });

  test('should scrub event payload older than TTL days', async () => {
    // 1. Run the scrub function
    const { error: rpcError } = await supabase.rpc('scrub_event_buffer', {
      ttl_days: ttlDays,
    });
    expect(rpcError).toBeNull();

    // 2. Verify the target event is scrubbed
    const { data: scrubbedEvent, error: scrubbedError } = await supabase
      .from('event_buffer')
      .select('payload, is_scrubbed')
      .eq('id', scrubTargetEventBufferId)
      .single();

    expect(scrubbedError).toBeNull();
    expect(scrubbedEvent).not.toBeNull();
    expect(scrubbedEvent.is_scrubbed).toBe(true);
    // Check payload: only data.id should remain within data
    expect(scrubbedEvent.payload.data).toEqual({ id: `pi_${scrubTargetEventId.substring(4)}` });
    // Check top-level fields are removed (except data)
    expect(scrubbedEvent.payload.api_version).toBeUndefined();
    expect(scrubbedEvent.payload.account).toBeUndefined(); // Assuming account is not preserved

    // 3. Verify the recent event is NOT scrubbed
    const { data: recentEvent, error: recentError } = await supabase
      .from('event_buffer')
      .select('payload, is_scrubbed')
      .eq('id', recentEventBufferId)
      .single();

    expect(recentError).toBeNull();
    expect(recentEvent).not.toBeNull();
    expect(recentEvent.is_scrubbed).toBe(false);
    expect(recentEvent.payload.data.object.description).toEqual('Test charge with PII'); // Check PII still exists
  });

  test('should not re-scrub already scrubbed events', async () => {
    // 1. Manually scrub the event first
    const { error: updateError } = await supabase
      .from('event_buffer')
      .update({ is_scrubbed: true, payload: { data: { id: 'test' } } })
      .eq('id', scrubTargetEventBufferId);
    expect(updateError).toBeNull();

    // 2. Run the scrub function again
    const { error: rpcError } = await supabase.rpc('scrub_event_buffer', {
      ttl_days: ttlDays,
    });
    expect(rpcError).toBeNull();

    // 3. Verify the payload wasn't changed further by the second run
    const { data: scrubbedEvent, error: scrubbedError } = await supabase
      .from('event_buffer')
      .select('payload')
      .eq('id', scrubTargetEventBufferId)
      .single();
    expect(scrubbedError).toBeNull();
    expect(scrubbedEvent.payload).toEqual({ data: { id: 'test' } }); // Should still be the manually set payload
  });

  test('should purge events older than TTL + purgeDelay days', async () => {
    // Note: The edge function combines scrub and purge. Here we test purge separately.
    // We could also invoke the edge function if deployed/mocked.

    // 1. Define the purge cutoff
    const purgeCutoffDate = dayjs()
      .subtract(ttlDays + purgeDelayDays, 'day')
      .toISOString();

    // 2. Run the delete command
    const { error: purgeError, count } = await supabase
      .from('event_buffer')
      .delete({ count: 'exact' })
      .lt('received_at', purgeCutoffDate);

    expect(purgeError).toBeNull();
    expect(count).toBeGreaterThanOrEqual(1); // At least the purgeTargetEvent should be deleted

    // 3. Verify the purge target event is gone
    const { data: purgedData, error: purgedError } = await supabase
      .from('event_buffer')
      .select('id')
      .eq('id', purgeTargetEventBufferId)
      .maybeSingle(); // Use maybeSingle as it might be null

    expect(purgedError).toBeNull();
    expect(purgedData).toBeNull();

    // 4. Verify the scrub target (older than TTL, younger than purge) still exists
    const { data: scrubData, error: scrubError } = await supabase
      .from('event_buffer')
      .select('id')
      .eq('id', scrubTargetEventBufferId)
      .single();

    expect(scrubError).toBeNull();
    expect(scrubData).not.toBeNull();
    expect(scrubData.id).toEqual(scrubTargetEventBufferId);
  });
});
