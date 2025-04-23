import { supabaseAdmin } from '@/lib/supabase-admin';
import { POST } from '@/app/api/waitlist/route';
import { NextRequest } from 'next/server';

// Mock the supabaseAdmin client
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
  },
}));

// Mock fetch for client component testing
global.fetch = jest.fn();

describe('Waitlist API', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('should handle valid email submission', async () => {
    // Create a mock request with a valid email
    const request = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    // Mock the supabaseAdmin client to return success
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock).mockResolvedValueOnce({ error: null });

    // Call the API endpoint
    const response = await POST(request);
    const data = await response.json();

    // Verify the response
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toBe("You're on the list! Check your inbox soon.");

    // Verify supabaseAdmin was called correctly
    expect(supabaseAdmin.from).toHaveBeenCalledWith('waitlist');
    expect(supabaseAdmin.insert).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('should handle duplicate email gracefully', async () => {
    // Create a mock request with a valid email
    const request = new NextRequest('http://localhost/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    // Mock the supabaseAdmin client to return a duplicate error
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock).mockResolvedValueOnce({ 
      error: { code: '23505', message: 'duplicate key value violates unique constraint' } 
    });

    // Call the API endpoint
    const response = await POST(request);
    const data = await response.json();

    // Verify the response is still successful
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toBe("You're already on the list!");
  });
}); 