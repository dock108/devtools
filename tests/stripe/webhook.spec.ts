import { describe, expect, vi, it, beforeEach, afterEach, Mock } from 'vitest';
import * as stripeModule from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { GUARDIAN_EVENTS } from '@/lib/guardian/stripeEvents';

// Mock isGuardianSupportedEvent before importing module
vi.mock('@/lib/guardian/stripeEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/guardian/stripeEvents')>();
  return {
    ...actual,
    // Pass through the implementation with spy
    isGuardianSupportedEvent: vi.fn(actual.isGuardianSupportedEvent),
  };
});

// Import the mocked function
import { isGuardianSupportedEvent } from '@/lib/guardian/stripeEvents';

// Mock the nextjs components
vi.mock('next/server', () => {
  class MockResponse {
    status: number;
    body: any;
    headers: Headers = new Headers();

    constructor(body: any, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status || 200;
      if (init?.headers) {
        this.headers = new Headers(init.headers);
      }
    }

    async json() {
      return Promise.resolve(this.body);
    }

    async text() {
      return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body));
    }
  }

  class MockRequest {
    method: string;
    _headers: Headers;
    _body: string | null;
    url: string;

    constructor(input: string | URL | globalThis.Request, init?: RequestInit) {
      if (typeof input === 'string' || input instanceof URL) {
        this.url = input.toString();
        this.method = init?.method?.toUpperCase() ?? 'GET';
        this._headers = new Headers(init?.headers);
        this._body = init?.body as string | null;
      } else {
        this.url = input.url;
        this.method = input.method;
        this._headers = new Headers(input.headers);
        this._body = null;
        // TODO: Handle body properly if input is Request
        // if (input.body) {
        // }
      }
    }

    get headers() {
      return this._headers;
    }

    async text(): Promise<string> {
      return Promise.resolve(this._body ?? '');
    }

    async json(): Promise<any> {
      try {
        return JSON.parse(this._body ?? 'null');
      } catch (e) {
        throw new SyntaxError('Unexpected end of JSON input');
      }
    }

    clone(): MockRequest {
      const init: RequestInit = { method: this.method, headers: this._headers };
      if (this._body) {
        init.body = this._body;
      }
      return new MockRequest(this.url, init);
    }
  }

  return {
    NextRequest: MockRequest,
    NextResponse: {
      json: (body: any, init?: { status?: number; headers?: HeadersInit }) =>
        new MockResponse(body, init),
      redirect: (url: string | URL, init?: number | ResponseInit) => {
        const status = typeof init === 'number' ? init : (init?.status ?? 307);
        const headers = typeof init === 'number' ? undefined : init?.headers;
        const responseHeaders = new Headers(headers);
        responseHeaders.set('Location', url.toString());
        return new MockResponse(null, { status, headers: responseHeaders });
      },
    },
  };
});

// Import after mocking
let POST: any;

// Mock the external dependencies
vi.mock('@/lib/stripe', () => {
  return {
    stripe: {
      webhooks: {
        constructEvent: vi.fn(),
      },
    },
  };
});

// Define accessible mock functions for Supabase
const supabaseMocks = {
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
};

// Mock the supabase-admin module
vi.mock('@/lib/supabase-admin', () => {
  // Reset mocks before defining behaviour for factory
  Object.values(supabaseMocks).forEach((mockFn) => mockFn.mockReset());

  // Setup the chain with default success
  supabaseMocks.single.mockResolvedValue({ data: { id: 1 }, error: null });
  supabaseMocks.select.mockReturnValue({ single: supabaseMocks.single });
  supabaseMocks.upsert.mockReturnValue({ select: supabaseMocks.select });
  supabaseMocks.from.mockReturnValue({ upsert: supabaseMocks.upsert });

  return {
    supabaseAdmin: {
      from: supabaseMocks.from,
    },
  };
});

vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  generateRequestId: vi.fn().mockReturnValue('test-req-id'),
}));

vi.mock('@/lib/logRequest', () => ({
  logRequest: vi.fn(),
}));

// Mock global fetch using vi
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('Success'),
    json: () => Promise.resolve({}),
  }),
);

// Mock performance.now() using vi
global.performance = {
  now: vi.fn().mockReturnValue(100),
} as any;

// Cast mocked imports for type safety
const constructEventMock = stripeModule.stripe.webhooks.constructEvent as Mock;
const isGuardianSupportedEventMock = isGuardianSupportedEvent as Mock;

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

  beforeEach(async () => {
    vi.clearAllMocks(); // Still clear all standard mocks
    // Reset our specific supabase mocks that live outside vi.mock factory scope
    Object.values(supabaseMocks).forEach((mockFn) => mockFn.mockClear());
    // Re-apply default successful chain behaviour *before each test* if needed
    // This ensures modifications in one test don't affect others.
    supabaseMocks.single.mockResolvedValue({ data: { id: 1 }, error: null });
    supabaseMocks.select.mockReturnValue({ single: supabaseMocks.single });
    supabaseMocks.upsert.mockReturnValue({ select: supabaseMocks.select });
    supabaseMocks.from.mockReturnValue({ upsert: supabaseMocks.upsert });

    // Original setup continues...
    const routeHandler = await import('@/app/api/stripe/webhook/route');
    POST = routeHandler.POST;

    constructEventMock.mockReturnValue({ ...mockStripeEvent });

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Success'),
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    // vi.resetAllMocks(); // Can potentially interfere with mocks defined outside factory
    // Stick to vi.clearAllMocks() in beforeEach for now.
  });

  it('should return 400 when signature header is missing', async () => {
    const { NextRequest } = await import('next/server');
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_test123' }),
      headers: {
        /* No stripe-signature */
      },
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Missing signature header');
  });

  it('should return 400 when signature verification fails', async () => {
    constructEventMock.mockImplementation(() => {
      const StripeError = vi.requireActual('stripe').errors.StripeSignatureVerificationError;
      throw new StripeError({} as any, 'Invalid signature');
    });

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify({ id: 'evt_test123' });
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
      },
    });

    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Signature verification failed');
  });

  it('should return 200 when account ID is missing', async () => {
    // Import the actual module for spying
    const validateModule = await import('@/lib/guardian/validateStripeEvent');
    // Spy and mock implementation for THIS test
    const isStrictSpy = vi.spyOn(validateModule, 'isStrictValidationEnabled').mockReturnValue(true);
    const validateSpy = vi
      .spyOn(validateModule, 'validateStripeEvent')
      .mockImplementation(() => {}); // Mock validation to pass

    constructEventMock.mockReturnValue({
      id: 'evt_test123',
      type: 'charge.succeeded',
      data: { object: { id: 'ch_test123', object: 'charge' } },
      // No account field in event
    });
    isGuardianSupportedEventMock.mockReturnValue(true);

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify({ id: 'evt_test123' });
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ message: 'Missing account ID' });

    // Optionally restore mocks if not handled by afterEach
    isStrictSpy.mockRestore();
    validateSpy.mockRestore();
  });

  it('should return 200 for unsupported event types', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_test123',
      type: 'customer.created',
      account: 'acct_test123',
      data: { object: { id: 'cus_test123', object: 'customer' } },
    });
    isGuardianSupportedEventMock.mockReturnValue(false);

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify({ id: 'evt_test123', type: 'customer.created' });
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
        'stripe-account': 'acct_test123',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ message: 'Unsupported event type' });
    expect(isGuardianSupportedEventMock).toHaveBeenCalledWith('customer.created');
  });

  it('should return 200 but indicate validation failure if validation fails', async () => {
    const validateModule = await import('@/lib/guardian/validateStripeEvent');
    const { ZodError } = await import('zod');
    // Spy and mock implementation for THIS test
    const isStrictSpy = vi.spyOn(validateModule, 'isStrictValidationEnabled').mockReturnValue(true);
    const validateSpy = vi.spyOn(validateModule, 'validateStripeEvent').mockImplementation(() => {
      throw new ZodError([]);
    });

    constructEventMock.mockReturnValue({ ...mockStripeEvent, type: 'charge.succeeded' });
    isGuardianSupportedEventMock.mockReturnValue(true);

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify(mockStripeEvent);
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
        'stripe-account': 'acct_test123',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    // No specific Supabase mock needed here as it shouldn't be called

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ message: 'Event validation failed' });

    expect(constructEventMock).toHaveBeenCalled();
    expect(isGuardianSupportedEventMock).toHaveBeenCalledWith('charge.succeeded');
    expect(validateSpy).toHaveBeenCalled(); // Check the spy
    expect(supabaseMocks.from).not.toHaveBeenCalled(); // Check the actual mock
    expect(global.fetch).not.toHaveBeenCalled();

    isStrictSpy.mockRestore();
    validateSpy.mockRestore();
  });

  it('should process a valid webhook event successfully when validation passes', async () => {
    const validateModule = await import('@/lib/guardian/validateStripeEvent');
    // Spy and mock implementation for THIS test
    const isStrictSpy = vi.spyOn(validateModule, 'isStrictValidationEnabled').mockReturnValue(true);
    const validateSpy = vi
      .spyOn(validateModule, 'validateStripeEvent')
      .mockImplementation(() => {}); // Mock validation to pass

    constructEventMock.mockReturnValue({ ...mockStripeEvent, type: 'charge.succeeded' });
    isGuardianSupportedEventMock.mockReturnValue(true);

    // Supabase mock uses default success from beforeEach

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify(mockStripeEvent);
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
        'stripe-account': 'acct_test123',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    // Fetch mock uses default success from beforeEach

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ received: true });

    expect(constructEventMock).toHaveBeenCalled();
    expect(isGuardianSupportedEventMock).toHaveBeenCalledWith('charge.succeeded');
    expect(validateSpy).toHaveBeenCalled(); // Check the spy
    expect(supabaseMocks.from).toHaveBeenCalledWith('event_buffer'); // Check actual mock
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(expect.any(Object), expect.any(Object)); // Check actual mock
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/guardian-reactor'), // Corrected path based on handler
      expect.any(Object),
    );

    isStrictSpy.mockRestore();
    validateSpy.mockRestore();
  });

  it('should return 200 even on errors during event buffer upsert', async () => {
    const validateModule = await import('@/lib/guardian/validateStripeEvent');
    // Spy and mock implementation for THIS test
    const isStrictSpy = vi.spyOn(validateModule, 'isStrictValidationEnabled').mockReturnValue(true);
    const validateSpy = vi
      .spyOn(validateModule, 'validateStripeEvent')
      .mockImplementation(() => {}); // Mock validation to pass

    constructEventMock.mockReturnValue({ ...mockStripeEvent });
    isGuardianSupportedEventMock.mockReturnValue(true);

    // Mock the final .single() call to return an error
    const dbError = { message: 'DB upsert failed', details: '', hint: '', code: 'XYZ' };
    supabaseMocks.single.mockResolvedValueOnce({ data: null, error: dbError });

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify(mockStripeEvent);
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
        'stripe-account': 'acct_test123',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ received: true });
    expect(supabaseMocks.upsert).toHaveBeenCalled(); // Check the actual mock was called
    expect(global.fetch).not.toHaveBeenCalled();

    isStrictSpy.mockRestore();
    validateSpy.mockRestore();
  });

  it('should return 200 even on failure when triggering the reactor function', async () => {
    const validateModule = await import('@/lib/guardian/validateStripeEvent');
    // Spy and mock implementation for THIS test
    const isStrictSpy = vi.spyOn(validateModule, 'isStrictValidationEnabled').mockReturnValue(true);
    const validateSpy = vi
      .spyOn(validateModule, 'validateStripeEvent')
      .mockImplementation(() => {}); // Mock validation to pass

    constructEventMock.mockReturnValue({ ...mockStripeEvent });
    isGuardianSupportedEventMock.mockReturnValue(true);

    // Supabase mock uses default success from beforeEach

    // Mock fetch to fail
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Reactor trigger failed'));

    const { NextRequest } = await import('next/server');
    const reqBody = JSON.stringify(mockStripeEvent);
    const mockRequest = new NextRequest('http://test.com/api/stripe/webhook', {
      method: 'POST',
      body: reqBody,
      headers: {
        'stripe-signature': 'test_signature',
        'stripe-account': 'acct_test123',
      },
    });
    vi.spyOn(mockRequest, 'text').mockResolvedValue(reqBody);

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ received: true });
    expect(supabaseMocks.upsert).toHaveBeenCalled(); // Check the actual mock
    expect(global.fetch).toHaveBeenCalled();

    isStrictSpy.mockRestore();
    validateSpy.mockRestore();
  });
});
