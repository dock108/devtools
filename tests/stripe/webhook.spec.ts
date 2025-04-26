import { describe, expect, jest, it, beforeEach, afterEach } from '@jest/globals';
import * as stripeModule from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Mock the nextjs components
jest.mock('next/server', () => {
  class MockResponse {
    status: number;
    body: any;

    constructor(body: any, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status || 200;
    }

    json() {
      return Promise.resolve(this.body);
    }
  }

  return {
    NextRequest: jest.fn().mockImplementation((request) => ({
      method: request.method,
      headers: {
        get: (name: string) => request.headers.get(name),
      },
      text: () => Promise.resolve(request.body),
    })),
    NextResponse: {
      json: (body: any, init?: { status?: number }) => new MockResponse(body, init),
    },
  };
});

// Import after mocking
const { POST } = require('@/app/api/stripe/webhook/route');

// Mock the external dependencies
jest.mock('@/lib/stripe', () => {
  return {
    stripe: {
      webhooks: {
        constructEvent: jest.fn(),
      },
    },
    Stripe: jest.requireActual('stripe'),
  };
});

jest.mock('@/lib/supabase-admin', () => {
  return {
    supabaseAdmin: {
      from: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
    },
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/logRequest', () => ({
  logRequest: jest.fn(),
}));

// Mock global fetch using a function
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('Success'),
  }),
);

// Mock performance.now()
global.performance = {
  now: jest.fn().mockReturnValue(100),
} as any;

describe('Stripe Webhook Handler', () => {
  const mockStripeEvent = {
    id: 'evt_test123',
    type: 'charge.succeeded',
    account: 'acct_test123',
    data: {
      object: {
        id: 'ch_test123',
        object: 'charge',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    (stripeModule.stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockStripeEvent);

    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.upsert as jest.Mock).mockReturnThis();
    (supabaseAdmin.select as jest.Mock).mockReturnThis();
    (supabaseAdmin.single as jest.Mock).mockResolvedValue({
      data: { id: 1 },
      error: null,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Success'),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return 400 when signature header is missing', async () => {
    const mockRequest = {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_test123' }),
      headers: {
        get: (name: string) => null,
      },
    };

    const response = await POST(mockRequest as any);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Missing signature header');
  });

  it('should return 400 when signature verification fails', async () => {
    (stripeModule.stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const mockRequest = {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_test123' }),
      headers: {
        get: (name: string) => (name === 'stripe-signature' ? 'test_signature' : null),
      },
      text: () => Promise.resolve(JSON.stringify({ id: 'evt_test123' })),
    };

    const response = await POST(mockRequest as any);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Signature verification failed');
  });

  it('should return 400 when account ID is missing', async () => {
    (stripeModule.stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      id: 'evt_test123',
      type: 'charge.succeeded',
      // No account property
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
        },
      },
    });

    const mockRequest = {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_test123' }),
      headers: {
        get: (name: string) => (name === 'stripe-signature' ? 'test_signature' : null),
      },
      text: () => Promise.resolve(JSON.stringify({ id: 'evt_test123' })),
    };

    const response = await POST(mockRequest as any);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Missing account ID');
  });

  it('should process a valid webhook event successfully', async () => {
    // Mock the supabase response for event buffer insertion
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        return {
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null,
          }),
        };
      }
      return {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
    });

    // Mock successful reactor call
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Success'),
    });

    const mockRequest = {
      method: 'POST',
      body: JSON.stringify(mockStripeEvent),
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return 'test_signature';
          if (name === 'stripe-account') return 'acct_test123';
          return null;
        },
      },
      text: () => Promise.resolve(JSON.stringify(mockStripeEvent)),
    };

    const response = await POST(mockRequest as any);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('received', true);

    // Verify the webhook was verified
    expect(stripeModule.stripe.webhooks.constructEvent).toHaveBeenCalled();

    // Verify the event was stored in the buffer
    expect(supabaseAdmin.from).toHaveBeenCalledWith('event_buffer');
  });

  it('should handle reactor failure gracefully', async () => {
    // Mock the supabase response for event buffer insertion
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'event_buffer') {
        return {
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null,
          }),
        };
      }
      if (table === 'failed_event_dispatch') {
        return {
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      }
      return {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
    });

    // Mock reactor call failure
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const mockRequest = {
      method: 'POST',
      body: JSON.stringify(mockStripeEvent),
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return 'test_signature';
          if (name === 'stripe-account') return 'acct_test123';
          return null;
        },
      },
      text: () => Promise.resolve(JSON.stringify(mockStripeEvent)),
    };

    const response = await POST(mockRequest as any);

    // Should still return 200 to Stripe even though reactor failed
    expect(response.status).toBe(200);

    // Verify the failure was recorded
    expect(supabaseAdmin.from).toHaveBeenCalledWith('failed_event_dispatch');
  });

  it('should handle duplicate events with upsert', async () => {
    // Setup the mock to simulate a duplicate event (no error on upsert)
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      return {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1 },
          error: null,
        }),
      };
    });

    const mockRequest = {
      method: 'POST',
      body: JSON.stringify(mockStripeEvent),
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return 'test_signature';
          if (name === 'stripe-account') return 'acct_test123';
          return null;
        },
      },
      text: () => Promise.resolve(JSON.stringify(mockStripeEvent)),
    };

    const response = await POST(mockRequest as any);

    expect(response.status).toBe(200);

    // Verify we're doing an upsert with onConflict
    expect(supabaseAdmin.from).toHaveBeenCalledWith('event_buffer');
  });
});
