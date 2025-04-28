import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase'; // Assuming generated types are here

// Basic stub function for fluent interface mocking
const chainable = (): any => {
  const handler: ProxyHandler<any> = {
    get: (target, prop) => {
      // Return the mock function itself for chaining
      if (typeof target[prop] === 'function') {
        return target[prop]; // Allow calling explicitly mocked methods
      }
      // Return a jest mock function for any other property access to allow spying/assertions
      target[prop] = jest.fn(() => handler); // Return proxy for further chaining
      return target[prop];
    },
  };
  // Start with an empty object proxy
  return new Proxy({}, handler);
};

/**
 * Creates a basic mock Supabase client with chainable methods.
 * Replace specific methods with jest.fn() implementations as needed for assertions.
 * Assumes Database types are generated at types/supabase.d.ts
 */
export function createMockSupabase<
  Db extends Record<string, any> = Database,
>(): SupabaseClient<Db> {
  // Basic structure matching SupabaseClient methods
  const mockClient = {
    from: jest.fn(() => ({
      select: jest.fn(chainable),
      insert: jest.fn(chainable),
      upsert: jest.fn(chainable),
      update: jest.fn(chainable),
      delete: jest.fn(chainable),
      // Add other common methods with chainable stubs
      eq: jest.fn(chainable),
      neq: jest.fn(chainable),
      gt: jest.fn(chainable),
      gte: jest.fn(chainable),
      lt: jest.fn(chainable),
      lte: jest.fn(chainable),
      like: jest.fn(chainable),
      in: jest.fn(chainable),
      is: jest.fn(chainable),
      contains: jest.fn(chainable),
      containedBy: jest.fn(chainable),
      // Methods returning promises need specific mocking in tests
      single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      // Add RPC mock
      rpc: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    })),
    // Add other top-level client properties/methods if needed
    auth: {
      // Mock auth methods if used in tests
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      // ... other auth methods
    },
    storage: {
      // Mock storage methods if used
      from: jest.fn(() => ({
        // ... storage methods
      })),
    },
    // Add any other root properties accessed in tests
  };

  // Use 'as unknown' then cast to SupabaseClient to bypass strict type checks on the mock object itself
  return mockClient as unknown as SupabaseClient<Db>;
}
