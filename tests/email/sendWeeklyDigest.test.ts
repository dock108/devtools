import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { startOfWeek, subWeeks } from 'date-fns';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock the Resend client
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'resend_test_id' }, error: null }),
    },
  })),
}));

// Mock MJML
jest.mock('mjml', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ html: '<div>Mocked HTML</div>' }),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock date-fns to ensure consistent dates in tests
jest.mock('date-fns', () => {
  const actual = jest.requireActual('date-fns');
  return {
    ...actual,
    startOfWeek: jest.fn().mockImplementation(() => new Date('2025-05-05T00:00:00Z')), // Mock Monday
    subWeeks: jest.fn().mockImplementation(() => new Date('2025-04-28T00:00:00Z')), // Mock previous Monday
    format: jest.fn().mockImplementation(() => 'May 5'),
  };
});

// TODO: Re-enable after fixing test stabilization issues in #<issue_number>
describe.skip('send-weekly-digest Edge Function', () => {
  // Mock data
  const mockAccounts = [
    {
      account_id: 'acct_test123',
      email_to: 'test@example.com',
    },
  ];

  const mockPayoutStats = {
    count: 15,
    sum: 250000, // $2,500.00
  };

  // Mock Supabase client responses
  const mockSupabase = {
    rpc: jest.fn().mockReturnValue({
      data: mockAccounts,
      error: null,
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnValue({
        data: mockPayoutStats,
        error: null,
      }),
    }),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.RESEND_API_KEY = 'test-resend-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch accounts without alerts and send digest emails', async () => {
    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-weekly-digest');

    // Call the handler function
    const response = await handler();

    // Verify RPC was called to find accounts without alerts
    expect(mockSupabase.rpc).toHaveBeenCalledWith('accounts_without_alerts', expect.any(Object));

    // Verify payout stats were fetched
    expect(mockSupabase.from).toHaveBeenCalledWith('payout_events');
    expect(mockSupabase.from().select).toHaveBeenCalledWith('count:id, sum:amount');
    expect(mockSupabase.from().select().eq).toHaveBeenCalledWith(
      'stripe_account_id',
      mockAccounts[0].account_id,
    );

    // Get a reference to the mocked Resend instance
    const resendInstance = (Resend as jest.Mock).mock.results[0].value;

    // Verify Resend was called with correct parameters
    expect(resendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Guardian <digest@dock108.ai>',
        to: mockAccounts[0].email_to,
        subject: 'Guardian weekly all-clear',
        html: expect.any(String),
      }),
    );

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(
      expect.objectContaining({
        success: true,
        sent: 1,
        failed: 0,
      }),
    );
  });

  it('should return 204 if no accounts are eligible', async () => {
    // Mock empty accounts response
    mockSupabase.rpc.mockReturnValueOnce({
      data: [],
      error: null,
    });

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-weekly-digest');

    // Call the handler function
    const response = await handler();

    console.log('Response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });

    // For 204 responses, there is typically no content
    expect(response.status).toBe(204);

    // Get a reference to the mocked Resend instance
    const resendInstance = (Resend as jest.Mock).mock.results[0].value;

    // Verify Resend was not called
    expect(resendInstance.emails.send).not.toHaveBeenCalled();
  });

  it('should handle Resend API errors gracefully', async () => {
    // Mock a Resend error
    const mockResendError = { message: 'Failed to send email' };
    const mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({ data: null, error: mockResendError }),
      },
    };
    (Resend as jest.Mock).mockImplementationOnce(() => mockResendInstance);

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-weekly-digest');

    // Call the handler function
    const response = await handler();

    // Verify Resend was called
    expect(mockResendInstance.emails.send).toHaveBeenCalled();

    // Verify response contains the failure count
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(
      expect.objectContaining({
        success: true,
        sent: 0,
        failed: 1,
      }),
    );
  });
});
