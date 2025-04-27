import { test, expect, describe, beforeAll, afterAll, vi } from 'vitest';
import { POST, GET } from '../../app/api/guardian/alerts/feedback/route'; // Adjust path as needed

// --- Mocking --- //
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    returns: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => ({ data: { session: { user: { id: 'test-user-id' } } } })), // Mock successful session
    },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

// Mock prom-client (basic mock to prevent errors)
vi.mock('prom-client', () => ({
  register: {
    getSingleMetric: vi.fn(),
    contentType: 'text/plain',
    metrics: vi.fn(async () => 'mock_metrics_output'),
  },
  Counter: vi.fn(() => ({
    inc: vi.fn(),
    labels: vi.fn().mockReturnThis(),
  })),
  Gauge: vi.fn(() => ({
    set: vi.fn(),
    labels: vi.fn().mockReturnThis(),
  })),
  Histogram: vi.fn(() => ({
    observe: vi.fn(),
    labels: vi.fn().mockReturnThis(),
    startTimer: vi.fn(() => vi.fn()),
  })),
  Summary: vi.fn(() => ({
    observe: vi.fn(),
    labels: vi.fn().mockReturnThis(),
    startTimer: vi.fn(() => vi.fn()),
  })),
  collectDefaultMetrics: vi.fn(),
}));

// --- Test Suite --- //
describe('Alert Feedback API Route (tests/feedback.spec.ts)', () => {
  const MOCK_ALERT_ID = 'alert-uuid-123';
  const MOCK_USER_ID = 'test-user-id';

  // Reset mocks between tests
  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- POST Tests --- //
  describe('POST /api/guardian/alerts/feedback', () => {
    test('should insert new feedback successfully', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      vi.mocked(supabaseAdmin.upsert).mockResolvedValueOnce({
        data: [{ id: 'feedback-uuid-1' }],
        error: null,
      });
      vi.mocked(supabaseAdmin.select).mockReturnThis(); // Chain .select()
      vi.mocked(supabaseAdmin.single).mockResolvedValueOnce({
        data: { id: 'feedback-uuid-1' },
        error: null,
      }); // Mock the single() call result

      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: MOCK_ALERT_ID, verdict: 'legit' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.feedbackId).toBe('feedback-uuid-1');
      expect(vi.mocked(supabaseAdmin.upsert)).toHaveBeenCalledWith(
        { alert_id: MOCK_ALERT_ID, user_id: MOCK_USER_ID, verdict: 'legit', comment: null },
        { onConflict: 'alert_id, user_id' },
      );
    });

    test('should update existing feedback successfully', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      vi.mocked(supabaseAdmin.upsert).mockResolvedValueOnce({
        data: [{ id: 'feedback-uuid-2' }],
        error: null,
      });
      vi.mocked(supabaseAdmin.select).mockReturnThis();
      vi.mocked(supabaseAdmin.single).mockResolvedValueOnce({
        data: { id: 'feedback-uuid-2' },
        error: null,
      });

      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: MOCK_ALERT_ID,
          verdict: 'false_positive',
          comment: 'Changed mind',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.feedbackId).toBe('feedback-uuid-2');
      expect(vi.mocked(supabaseAdmin.upsert)).toHaveBeenCalledWith(
        {
          alert_id: MOCK_ALERT_ID,
          user_id: MOCK_USER_ID,
          verdict: 'false_positive',
          comment: 'Changed mind',
        },
        { onConflict: 'alert_id, user_id' },
      );
    });

    test('should return 401 if not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      vi.mocked(createServerClient).mockImplementationOnce(
        () =>
          ({
            auth: {
              getSession: vi.fn(() => ({ data: { session: null }, error: null })), // Simulate no session
            },
          }) as any,
      );

      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        body: JSON.stringify({ alertId: MOCK_ALERT_ID, verdict: 'legit' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    test('should return 400 for invalid request body', async () => {
      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: MOCK_ALERT_ID /* missing verdict */ }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    test('should handle database error during upsert', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      vi.mocked(supabaseAdmin.upsert).mockResolvedValueOnce({
        data: null,
        error: new Error('DB connection failed'),
      });

      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: MOCK_ALERT_ID, verdict: 'legit' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Failed to record feedback');
    });

    // TODO: Add test for metrics increment logic when prom-client is properly integrated
  });

  // --- GET Tests --- //
  describe('GET /api/guardian/alerts/feedback', () => {
    test('should return aggregated feedback counts successfully', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      const mockCounts = [
        { verdict: 'false_positive', count: 3 },
        { verdict: 'legit', count: 7 },
      ];
      vi.mocked(supabaseAdmin.returns).mockResolvedValueOnce({ data: mockCounts, error: null });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ false_positive: 3, legit: 7 });
      expect(vi.mocked(supabaseAdmin.select)).toHaveBeenCalledWith('verdict, count', {
        count: 'exact',
      });
      expect(vi.mocked(supabaseAdmin.eq)).toHaveBeenCalledWith('alert_id', MOCK_ALERT_ID);
    });

    test('should return zero counts if no feedback exists', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      vi.mocked(supabaseAdmin.returns).mockResolvedValueOnce({ data: [], error: null }); // Simulate no rows found

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ false_positive: 0, legit: 0 });
    });

    test('should return 401 if not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      vi.mocked(createServerClient).mockImplementationOnce(
        () =>
          ({
            auth: {
              getSession: vi.fn(() => ({ data: { session: null }, error: null })), // Simulate no session
            },
          }) as any,
      );

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        {
          method: 'GET',
        },
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    test('should return 400 if alertId parameter is missing', async () => {
      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        // Missing alertId
        method: 'GET',
      });
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    test('should handle database error during count fetch', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      vi.mocked(supabaseAdmin.returns).mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to query DB'),
      });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Failed to fetch feedback counts');
    });
  });
});
