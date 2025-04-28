import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { POST, GET } from '@/app/api/guardian/alerts/feedback/route';
import { createAdminClient } from '@/lib/supabase/admin';

// --- Mocking --- //

// Mock the query builder methods using jest.fn
const mockQueryBuilder = {
  from: jest.fn(),
  upsert: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  in: jest.fn(),
  filter: jest.fn(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
};

// Mock the Supabase client object using jest.fn
const supabaseAdmin = {
  from: jest.fn(() => mockQueryBuilder),
  // rpc: jest.fn(), // Add if needed
};

// Mock the factory function using jest.mock
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => supabaseAdmin),
}));

// Mock auth and cookies using jest.mock
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } } }),
    },
  })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  })),
}));

// Mock prom-client using jest.mock
jest.mock('prom-client', () => ({
  register: {
    getSingleMetric: jest.fn(),
    contentType: 'text/plain',
    metrics: jest.fn(async () => 'mock_metrics_output'),
  },
  Counter: jest.fn(() => ({
    inc: jest.fn(),
    labels: jest.fn().mockReturnThis(),
  })),
  Gauge: jest.fn(() => ({
    set: jest.fn(),
    labels: jest.fn().mockReturnThis(),
  })),
  Histogram: jest.fn(() => ({
    observe: jest.fn(),
    labels: jest.fn().mockReturnThis(),
    startTimer: jest.fn(() => jest.fn()), // Use jest.fn here too
  })),
  Summary: jest.fn(() => ({
    observe: jest.fn(),
    labels: jest.fn().mockReturnThis(),
    startTimer: jest.fn(() => jest.fn()), // Use jest.fn here too
  })),
  collectDefaultMetrics: jest.fn(),
}));

// --- Test Suite --- //
describe('Alert Feedback API Route (tests/feedback.spec.ts)', () => {
  const MOCK_ALERT_ID = 123;
  const MOCK_USER_ID = 'test-user-id';

  // Use beforeEach if setup needed before each test (Jest)
  beforeEach(() => {
    // Use jest.clearAllMocks()
    jest.clearAllMocks();
    // Optional: Reset specific mock implementations if needed
    // supabaseAdmin.from.mockImplementation(() => mockQueryBuilder);
  });

  // afterEach remains the same conceptually, just using Jest API
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- POST Tests --- //
  describe('POST /api/guardian/alerts/feedback', () => {
    // Use it instead of test
    it('should insert new feedback successfully', async () => {
      mockQueryBuilder.upsert.mockResolvedValueOnce({
        data: [{ id: 'feedback-uuid-1' }],
        error: null,
      });

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
      expect(supabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          // Jest's expect.objectContaining
          alert_id: MOCK_ALERT_ID,
          user_id: MOCK_USER_ID,
          verdict: 'legit',
        }),
        { onConflict: 'alert_id, user_id' },
      );
    });

    it('should update existing feedback successfully', async () => {
      mockQueryBuilder.upsert.mockResolvedValueOnce({
        data: [{ id: 'feedback-uuid-2' }],
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
      expect(supabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        {
          alert_id: MOCK_ALERT_ID,
          user_id: MOCK_USER_ID,
          verdict: 'false_positive',
          comment: 'Changed mind',
        },
        { onConflict: 'alert_id, user_id' },
      );
    });

    it('should return 401 if not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      // Use jest.mocked if needed for type safety, or access mock directly
      (createServerClient as jest.Mock).mockImplementationOnce(
        () =>
          ({
            auth: {
              getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
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

    it('should return 400 for invalid request body', async () => {
      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: MOCK_ALERT_ID /* missing verdict */ }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should handle database error during upsert', async () => {
      mockQueryBuilder.upsert.mockResolvedValueOnce({
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
  });

  // --- GET Tests --- //
  describe('GET /api/guardian/alerts/feedback', () => {
    it('should return aggregated feedback counts successfully', async () => {
      const mockCounts = [
        { verdict: 'false_positive', count: 3 },
        { verdict: 'legit', count: 7 },
      ];
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: mockCounts, error: null });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        { method: 'GET' },
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ false_positive: 3, legit: 7 });
      expect(supabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('verdict, count');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('alert_id', MOCK_ALERT_ID);
    });

    it('should return zero counts if no feedback exists', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        { method: 'GET' },
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ false_positive: 0, legit: 0 });
    });

    it('should return 401 if not authenticated', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      (createServerClient as jest.Mock).mockImplementationOnce(
        () =>
          ({
            auth: {
              getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
            },
          }) as any,
      );

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        { method: 'GET' },
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 if alertId parameter is missing', async () => {
      const request = new Request('http://localhost/api/guardian/alerts/feedback', {
        method: 'GET',
      });
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('should handle database error during count fetch', async () => {
      // Note: The original mock accessed supabaseAdmin.returns which is incorrect.
      // We mock the chain select().eq()
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to query DB'),
      });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        { method: 'GET' },
      );

      const response = await GET(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Failed to fetch feedback counts');
    });
  });
});

// Removed export {}; - not typically needed for Jest/CommonJS focused setups
