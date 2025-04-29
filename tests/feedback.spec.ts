import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { POST, GET } from '@/app/api/guardian/alerts/feedback/route';
import { createAdminClient } from '@/lib/supabase/admin'; // Original import
import { Database } from '@/types/supabase'; // Import Database type
import { createMockSupabase } from '@/tests/__utils__/mockSupabase';

// --- Mocking --- //

// Create the mock client instance
const mockSupabaseAdmin = createMockSupabase<Database>();

// Mock the factory function to return our mock instance
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockSupabaseAdmin),
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
    // Reset specific mock implementations for Supabase calls if needed
    // Example: mockSupabaseAdmin.from(...).upsert.mockClear();
    // Or reset mock return values if they vary between tests
    jest.mocked(mockSupabaseAdmin.from).mockImplementation(() => ({
      // Provide default implementations for chained methods used in tests
      upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      // Add other chained methods with default mocks if needed
      ...createMockSupabase<Database>().from('any_table'), // Spread default chainable mocks
    }));
  });

  // afterEach remains the same conceptually, just using Jest API
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- POST Tests --- //
  describe('POST /api/guardian/alerts/feedback', () => {
    // Use it instead of test
    it('should insert new feedback successfully', async () => {
      // Arrange: Mock the upsert call
      const mockUpsert = jest
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 'feedback-uuid-1' }], error: null });
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'), // Start with default chainable mocks
        upsert: mockUpsert,
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
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockUpsert).toHaveBeenCalledWith(
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
      // Arrange: Mock the upsert call
      const mockUpsert = jest
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 'feedback-uuid-2' }], error: null });
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'),
        upsert: mockUpsert,
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
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockUpsert).toHaveBeenCalledWith(
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
      // Arrange: Mock upsert to return an error
      const dbError = new Error('DB connection failed');
      const mockUpsert = jest.fn().mockResolvedValueOnce({ data: null, error: dbError });
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'),
        upsert: mockUpsert,
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
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  // --- GET Tests --- //
  describe('GET /api/guardian/alerts/feedback', () => {
    it('should return aggregated feedback counts successfully', async () => {
      // Arrange: Mock the select().eq() call chain
      const mockCounts = [
        { verdict: 'false_positive', count: 3 },
        { verdict: 'legit', count: 7 },
      ];
      const mockEq = jest.fn().mockResolvedValueOnce({ data: mockCounts, error: null });
      const mockSelect = jest.fn().mockReturnThis(); // select returns 'this' for chaining
      // Mock the return value of .from() to include our specific select and eq mocks
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'),
        select: mockSelect,
        eq: mockEq,
      });

      const request = new Request(
        `http://localhost/api/guardian/alerts/feedback?alertId=${MOCK_ALERT_ID}`,
        { method: 'GET' },
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ false_positive: 3, legit: 7 });
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('alert_feedback');
      expect(mockSelect).toHaveBeenCalledWith('verdict, count');
      expect(mockEq).toHaveBeenCalledWith('alert_id', MOCK_ALERT_ID);
    });

    it('should return zero counts if no feedback exists', async () => {
      // Arrange: Mock select().eq() to return empty data
      const mockEq = jest.fn().mockResolvedValueOnce({ data: [], error: null });
      const mockSelect = jest.fn().mockReturnThis();
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'),
        select: mockSelect,
        eq: mockEq,
      });

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
      // Arrange: Mock select().eq() to return an error
      const dbError = new Error('DB read error');
      const mockEq = jest.fn().mockResolvedValueOnce({ data: null, error: dbError });
      const mockSelect = jest.fn().mockReturnThis();
      jest.mocked(mockSupabaseAdmin.from).mockReturnValueOnce({
        ...createMockSupabase<Database>().from('alert_feedback'),
        select: mockSelect,
        eq: mockEq,
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
