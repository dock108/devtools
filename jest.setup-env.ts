// jest.setup-env.ts
// Provides dummy environment variables for Jest tests

// Polyfills/Stubs for jsdom environment
global.setImmediate = (callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate => {
  return setTimeout(callback, 0, ...args) as unknown as NodeJS.Immediate;
};
global.clearImmediate = (id: NodeJS.Immediate): void => {
  clearTimeout(id as unknown as number);
};

// Basic polyfill for Request if not present (might need more robust solution)
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input: any, init?: RequestInit) {
      // Basic stub - may need expansion depending on test usage
      console.warn('[jest.setup-env.ts] Using basic Request polyfill stub.');
    }
  } as any;
}

// Basic mock for pino logger used in tests
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  child: jest.fn(() => mockLogger), // Return self for child loggers
};
jest.mock('@/lib/logger', () => ({ logger: mockLogger }));
jest.mock('@/lib/edge-logger', () => ({ edgeLogger: mockLogger }));

// Dummy environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
process.env.RESEND_API_KEY = 're_dummy';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

// Add any other required environment variables here with dummy values
// process.env.SOME_OTHER_KEY = 'dummy-value';

console.log('[jest.setup-env.ts] Loaded dummy environment variables and polyfills/mocks for Jest.');
