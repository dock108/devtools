import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { POST } from '@/app/api/contact/route';

// Mock the Request object
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.body = options.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
}

// Mock environment variables
const originalEnv = process.env;

// Mock dependencies
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

jest.mock('@/lib/resend', () => ({
  __esModule: true,
  default: {
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id', error: null }),
    },
  },
}));

describe('Contact API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup environment variables for tests
    process.env = { ...originalEnv, FROM_EMAIL: 'test@dock108.ai' };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('returns 201 for valid form submission', async () => {
    const req = new MockRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a test message',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
  });

  it('returns 400 for missing required fields', async () => {
    const req = new MockRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        // email is missing
        message: 'This is a test message',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 400 when honeypot field is filled', async () => {
    const req = new MockRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a test message',
        website: 'http://spam.com', // Honeypot field is filled
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const req = new MockRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'not-an-email',
        message: 'This is a test message',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 400 for message that is too long', async () => {
    const longMessage = 'a'.repeat(1001); // Exceeds 1000 character limit

    const req = new MockRequest('http://localhost:3000/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: longMessage,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
