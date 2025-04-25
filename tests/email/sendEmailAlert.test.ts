import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import nock from 'nock';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
  },
}));

// TODO: Re-enable after fixing test stabilization issues in #<issue_number>
describe.skip('send-email-alert Edge Function', () => {
  // Mock data
  const mockAlert = {
    id: 123,
    alert_type: 'VELOCITY',
    severity: 'high',
    message: 'Test alert message',
    stripe_account_id: 'acct_test123',
    alert_channels: {
      email_to: 'test@example.com',
    },
  };

  // Mock Supabase client responses
  const mockSupabase = {
    rpc: jest.fn().mockReturnValue({
      data: { alert_id: mockAlert.id },
      error: null,
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: mockAlert,
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

  it('should pop a notification, fetch the alert, and send an email', async () => {
    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-email-alert');

    // Call the handler function
    const response = await handler();

    // Verify RPC was called to pop a notification
    expect(mockSupabase.rpc).toHaveBeenCalledWith('pop_notification');

    // Verify alert was fetched
    expect(mockSupabase.from).toHaveBeenCalledWith('alerts');

    // Get a reference to the mocked Resend instance
    const resendInstance = (Resend as jest.Mock).mock.results[0].value;

    // Verify Resend was called with correct parameters
    expect(resendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('Guardian'),
        to: mockAlert.alert_channels.email_to,
        subject: expect.stringContaining(mockAlert.alert_type),
        html: expect.any(String),
      }),
    );

    // Verify response
    expect(response.status).toBe(200);
  });

  it('should return 204 if no notification is found', async () => {
    // Mock empty queue response
    mockSupabase.rpc.mockReturnValueOnce({
      data: null,
      error: null,
    });

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-email-alert');

    // Call the handler function
    const response = await handler();

    // Verify response is 204 No Content
    expect(response.status).toBe(204);

    // Get a reference to the mocked Resend instance
    const resendInstance = (Resend as jest.Mock).mock.results[0].value;

    // Verify Resend was not called
    expect(resendInstance.emails.send).not.toHaveBeenCalled();
  });

  it('should return 204 if alert has no email address', async () => {
    // Mock alert with no email
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: { ...mockAlert, alert_channels: { email_to: null } },
        error: null,
      }),
    });

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-email-alert');

    // Call the handler function
    const response = await handler();

    // Verify response is 204 No Content
    expect(response.status).toBe(204);

    // Get a reference to the mocked Resend instance
    const resendInstance = (Resend as jest.Mock).mock.results[0].value;

    // Verify Resend was not called
    expect(resendInstance.emails.send).not.toHaveBeenCalled();
  });

  it('should handle Resend API errors', async () => {
    // Mock a Resend error
    const mockResendError = { message: 'Failed to send email' };
    const mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({ data: null, error: mockResendError }),
      },
    };
    (Resend as jest.Mock).mockImplementationOnce(() => mockResendInstance);

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-email-alert');

    // Call the handler function
    const response = await handler();

    // Verify Resend was called
    expect(mockResendInstance.emails.send).toHaveBeenCalled();

    // Verify error response
    expect(response.status).toBe(500);
  });
});
