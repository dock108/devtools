import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Mock Supabase client for testing
export const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  data: null,
  error: null,
  count: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation(callback => Promise.resolve(callback({ data: null, error: null }))),
};

// Mock the Supabase client creation functions
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => mockSupabaseClient),
}));

// Helper to configure Supabase mock responses
export const mockSupabaseResponse = (method: string, response: any) => {
  if (method === 'select' || method === 'insert' || method === 'update' || method === 'delete') {
    (mockSupabaseClient[method] as jest.Mock).mockImplementation(() => ({
      ...mockSupabaseClient,
      then: jest.fn().mockImplementation(callback => Promise.resolve(callback(response))),
    }));
  } else {
    (mockSupabaseClient[method] as jest.Mock).mockReturnValue({
      ...mockSupabaseClient,
      data: response.data,
      error: response.error,
    });
  }
};

// Reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.keys(mockSupabaseClient).forEach(key => {
    if (typeof mockSupabaseClient[key] === 'function') {
      (mockSupabaseClient[key] as jest.Mock).mockClear();
    }
  });
  
  // Reset the implementation of createClient
  (createClient as jest.Mock).mockImplementation(() => mockSupabaseClient);
  (createBrowserClient as jest.Mock).mockImplementation(() => mockSupabaseClient);
}; 