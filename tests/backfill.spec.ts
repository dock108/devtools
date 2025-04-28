import { test, expect, describe, beforeAll, afterAll, afterEach, vi } from 'vitest';
import nock from 'nock';
import { EdgeRuntime } from 'edge-runtime'; // To simulate the Deno edge environment
import * as fs from 'fs/promises';
import * as path from 'path';

// --- Test Setup --- //
// Note: Strict type checking may require ensuring mock data and function signatures align perfectly.

const MOCK_SUPABASE_URL = 'http://localhost:54321'; // Mock Supabase URL
const MOCK_SUPABASE_KEY = 'mock-service-role-key';
const MOCK_STRIPE_KEY_PLATFORM = 'sk_test_platform123';
const MOCK_ACCOUNT_ID = 'acct_mock_backfill_123';
const MOCK_REACTOR_URL = `${MOCK_SUPABASE_URL}/functions/v1/guardian-reactor`;

// Mock data
// Ensure mock data types are consistent (e.g., use Stripe types if possible)
const createMockStripeEvent = (id: string, type: string, created: number, account: string) => ({
  id: `evt_${id}`,
  object: 'event' as const,
  api_version: '2022-11-15',
  created,
  livemode: false,
  pending_webhooks: 0,
  request: { id: null, idempotency_key: null },
  type,
  // @ts-expect-error - Simplify data object for testing - This might cause issues with strict checks if not handled
  data: { object: { id: `obj_${id}`, object: type.split('.')[0] ?? 'charge', amount: 1000 } },
  account: account,
});

// Generate ~250 mock events (e.g., 3 pages)
const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
const mockEventsPage1 = Array.from({ length: 100 }, (_, i) =>
  createMockStripeEvent(
    `p1_${i}`,
    i % 3 === 0 ? 'charge.succeeded' : 'payout.paid',
    ninetyDaysAgo + i * 100,
    MOCK_ACCOUNT_ID,
  ),
);
const mockEventsPage2 = Array.from({ length: 100 }, (_, i) =>
  createMockStripeEvent(
    `p2_${i}`,
    i % 2 === 0 ? 'charge.failed' : 'review.opened',
    ninetyDaysAgo + 10000 + i * 100,
    MOCK_ACCOUNT_ID,
  ),
);
const mockEventsPage3 = Array.from({ length: 50 }, (_, i) =>
  createMockStripeEvent(
    `p3_${i}`,
    'payment_intent.succeeded',
    ninetyDaysAgo + 20000 + i * 100,
    MOCK_ACCOUNT_ID,
  ),
);

describe('Guardian Backfill Edge Function (tests/backfill.spec.ts)', () => {
  let runtime: EdgeRuntime | undefined; // Initialize as possibly undefined
  let backfillFunctionCode: string;

  beforeAll(async () => {
    // Set mock environment variables
    process.env.SUPABASE_URL = MOCK_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = MOCK_SUPABASE_KEY;
    process.env.STRIPE_API_KEY_PLATFORM = MOCK_STRIPE_KEY_PLATFORM;
    process.env.BACKFILL_DAYS = '90';
    process.env.BACKFILL_BATCH = '100'; // Set batch size for testing

    // Load function code
    const functionPath = path.resolve(
      __dirname,
      '../supabase/functions/guardian-backfill/index.ts',
    );
    try {
      backfillFunctionCode = await fs.readFile(functionPath, 'utf-8');
      console.log('Successfully read guardian-backfill function code.');
    } catch (err) {
      console.error('Error reading guardian-backfill function file:', err);
      throw new Error(`Could not load function code from ${functionPath}.`);
    }

    // Mock the isGuardianSupportedEvent import
    // Ensure the mock function signature matches the original
    vi.mock('../../lib/guardian/stripeEvents.ts', () => ({
      isGuardianSupportedEvent: (type: string): boolean => {
        // Add explicit return type
        return !type.startsWith('customer.');
      },
    }));

    // Mock the fetch call to the reactor
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    // @ts-expect-error - Mocking global fetch for testing reactor trigger
    global.fetch = mockFetch;

    // Set a specific date for consistent testing
    // ... existing code ...

    // Runtime setup - ensure context types are correct
    runtime = new EdgeRuntime({
      extend: (context) => {
        // Explicitly type the env object if possible
        context.env = {
          SUPABASE_URL: MOCK_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: MOCK_SUPABASE_KEY,
          STRIPE_API_KEY_PLATFORM: MOCK_STRIPE_KEY_PLATFORM,
          BACKFILL_DAYS: '90',
          BACKFILL_BATCH: '100',
        };
        // Ensure Deno mock aligns with actual Deno types used
        context.Deno = { env: { get: (key: string): string | undefined => context.env[key] } }; // Add undefined possibility
        return context;
      },
      initialCode: backfillFunctionCode,
    });

    // Nock setup
    if (!nock.isActive()) nock.activate();
    nock.disableNetConnect();
    nock.enableNetConnect((host) => host.includes('localhost')); // Allow Supabase mock
  });

  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks(); // Clear mocks if using vi.fn()
  });

  afterAll(() => {
    nock.restore();
    nock.enableNetConnect();
    runtime?.dispose();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_API_KEY_PLATFORM;
    // ... clear other env vars
  });

  // --- Test Cases --- //

  test('should backfill events, update status, and trigger reactor', async () => {
    const expectedEventCount =
      mockEventsPage1.length + mockEventsPage2.length + mockEventsPage3.length;
    // Adjust count based on mock isGuardianSupportedEvent filter if needed
    const expectedRelevantCount = expectedEventCount; // Assuming all are relevant for simplicity here
    const expectedBatches = Math.ceil(expectedRelevantCount / 100); // Based on BACKFILL_BATCH=100

    // --- Mock Supabase Interactions ---
    // 1. Initial status check (assume pending or not found)
    const statusCheckScope = nock(MOCK_SUPABASE_URL)
      .get(
        `/rest/v1/backfill_status?select=status%2Clast_event_id&stripe_account_id=eq.${MOCK_ACCOUNT_ID}`,
      )
      .reply(406, {}); // Simulate PGRST116 (no rows found) or return { status: 'pending' }
    // .reply(200, { status: 'pending', last_event_id: null });

    // 2. Update status to running
    const statusRunningScope = nock(MOCK_SUPABASE_URL)
      .patch(`/rest/v1/backfill_status?stripe_account_id=eq.${MOCK_ACCOUNT_ID}`)
      .reply(200);

    // 3. Mock event_buffer upserts (expect multiple batches)
    // We check the number of calls rather than exact payload for simplicity
    const bufferUpsertScope = nock(MOCK_SUPABASE_URL)
      .post(`/rest/v1/event_buffer?on_conflict=stripe_event_id`)
      .times(expectedBatches) // Expect calls = total relevant events / batch size
      .reply(200, (uri, requestBody) => {
        // Ensure requestBody typing is handled (e.g., using unknown -> validation or explicit cast)
        const batch = requestBody as any[]; // Cast carefully, validate if possible
        // Ensure returned IDs match expected { id: number | string }[] structure
        return batch.map((e) => ({ id: `buf_${e.stripe_event_id}` }));
      });

    // 4. Mock reactor trigger calls (fire and forget, so don't strictly need mock, but good for counting)
    const reactorScope = nock(MOCK_SUPABASE_URL)
      .post(`/functions/v1/guardian-reactor`)
      .times(expectedRelevantCount) // Should be called for each relevant event
      .reply(202);

    // 5. Mock intermediate status updates (running with last_event_id)
    // It should update after each *successful* batch insert triggering the reactor
    const statusIntermediateScope = nock(MOCK_SUPABASE_URL)
      .patch(`/rest/v1/backfill_status?stripe_account_id=eq.${MOCK_ACCOUNT_ID}`)
      .times(expectedBatches) // Should update status after each processed batch
      .reply(200);

    // 6. Final status update to success
    const statusSuccessScope = nock(MOCK_SUPABASE_URL)
      .patch(`/rest/v1/backfill_status?stripe_account_id=eq.${MOCK_ACCOUNT_ID}`)
      .reply(200, (uri, body: Record<string, any>) => {
        // Type the body
        expect(body.status).toBe('success');
        expect(body.completed_at).toBeDefined(); // Check for existence, type check happens implicitly
        expect(body.last_event_id).toBe(mockEventsPage3[mockEventsPage3.length - 1].id); // Last event of last page
        return {};
      });

    // --- Mock Stripe API Calls ---
    const stripeScope = nock('https://api.stripe.com')
      // Page 1
      .get('/v1/events')
      .query({ limit: 100, 'created[gte]': ninetyDaysAgo })
      .reply(200, { object: 'list', data: mockEventsPage1, has_more: true, url: '/v1/events' })
      // Page 2
      .get('/v1/events')
      .query({ limit: 100, 'created[gte]': ninetyDaysAgo, starting_after: mockEventsPage1[99].id })
      .reply(200, { object: 'list', data: mockEventsPage2, has_more: true, url: '/v1/events' })
      // Page 3
      .get('/v1/events')
      .query({ limit: 100, 'created[gte]': ninetyDaysAgo, starting_after: mockEventsPage2[99].id })
      .reply(200, { object: 'list', data: mockEventsPage3, has_more: false, url: '/v1/events' }); // has_more: false

    // --- Execute Function --- //
    if (!runtime) throw new Error('Runtime not initialized'); // Type guard
    const response = await runtime.dispatchFetch('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripe_account_id: MOCK_ACCOUNT_ID }),
    });

    // --- Assertions --- //
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Verify all nock scopes were called as expected
    expect(statusCheckScope.isDone()).toBe(true);
    expect(statusRunningScope.isDone()).toBe(true);
    expect(stripeScope.isDone()).toBe(true);
    expect(bufferUpsertScope.isDone()).toBe(true);
    expect(reactorScope.isDone()).toBe(true);
    expect(statusIntermediateScope.isDone()).toBe(true); // Check intermediate updates happened
    expect(statusSuccessScope.isDone()).toBe(true);
  }, 30000); // Increase timeout for potentially long test

  test('should exit early if backfill status is already running', async () => {
    // Mock status check to return 'running'
    nock(MOCK_SUPABASE_URL)
      .get(
        `/rest/v1/backfill_status?select=status%2Clast_event_id&stripe_account_id=eq.${MOCK_ACCOUNT_ID}`,
      )
      .reply(200, { status: 'running', last_event_id: null });

    // Execute
    const response = await runtime.dispatchFetch('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripe_account_id: MOCK_ACCOUNT_ID }),
    });

    // Assert
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.message).toContain('already in progress');
  });

  test('should exit early if backfill status is already success', async () => {
    // Mock status check to return 'success'
    nock(MOCK_SUPABASE_URL)
      .get(
        `/rest/v1/backfill_status?select=status%2Clast_event_id&stripe_account_id=eq.${MOCK_ACCOUNT_ID}`,
      )
      .reply(200, { status: 'success', last_event_id: 'evt_some_last_id' });

    // Execute
    const response = await runtime.dispatchFetch('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripe_account_id: MOCK_ACCOUNT_ID }),
    });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('already complete');
  });

  test('should handle Stripe API error during event fetch', async () => {
    // Mocks for initial status check and setting to running
    nock(MOCK_SUPABASE_URL)
      .get(
        `/rest/v1/backfill_status?select=status%2Clast_event_id&stripe_account_id=eq.${MOCK_ACCOUNT_ID}`,
      )
      .reply(406, {});
    nock(MOCK_SUPABASE_URL)
      .patch(`/rest/v1/backfill_status?stripe_account_id=eq.${MOCK_ACCOUNT_ID}`)
      .reply(200); // Sets to running

    // Mock Stripe failure on first page fetch
    nock('https://api.stripe.com')
      .get('/v1/events')
      .query(true) // Match any query params for this test
      .reply(401, {
        error: { message: 'Invalid API Key provided.', type: 'invalid_request_error' },
      });

    // Mock final status update to error
    const statusErrorScope = nock(MOCK_SUPABASE_URL)
      .patch(`/rest/v1/backfill_status?stripe_account_id=eq.${MOCK_ACCOUNT_ID}`)
      .reply(200, (uri, body: Record<string, any>) => {
        // Type the body
        expect(body.status).toBe('error');
        expect(body.completed_at).toBeDefined();
        expect(body.last_error).toContain('Invalid API Key provided');
        return {};
      });

    // Execute
    if (!runtime) throw new Error('Runtime not initialized'); // Type guard
    const response = await runtime.dispatchFetch('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripe_account_id: MOCK_ACCOUNT_ID }),
    });

    // Assert
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Backfill failed');
    expect(body.details).toContain('Invalid API Key provided');
    expect(statusErrorScope.isDone()).toBe(true);
  });

  test('should process events incrementally based on checkpoint', async () => {
    // Implementation of this test case
  });

  test('should handle empty event list from Stripe gracefully', async () => {
    // Implementation of this test case
  });

  test('should stop if Stripe returns fewer events than limit (end of stream)', async () => {
  it('should stop if Stripe returns fewer events than limit (end of stream)', async () => {
    // Implementation of this test case
  });

  it('should handle Stripe API errors during event fetching', async () => {
    // Implementation of this test case
  });

  it('should handle errors writing checkpoint file', async () => {
    // Implementation of this test case
  });

  it('should handle errors reading checkpoint file (and start from scratch)', async () => {
    // Implementation of this test case
  });

  it('should handle Supabase errors during event insertion', async () => {
    // Implementation of this test case
  });

  it('should skip processing if another instance is running (lock file exists)', async () => {
    // Implementation of this test case
  });
});
