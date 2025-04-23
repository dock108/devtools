import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import fetch from 'jest-fetch-mock';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('send-slack-alert Edge Function', () => {
  // Mock data
  const mockAlert = {
    id: 123,
    alert_type: 'VELOCITY',
    severity: 'high',
    message: 'Test alert message',
    stripe_account_id: 'acct_test123',
    alert_channels: {
      slack_webhook_url: 'https://hooks.slack.com/services/TEST/TEST/test',
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

    // Setup fetch mock
    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify({ ok: true }));

    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Mock setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') callback();
      return 0 as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should pop a notification, fetch the alert, and post to Slack', async () => {
    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify RPC was called to pop a notification
    expect(mockSupabase.rpc).toHaveBeenCalledWith('pop_notification');

    // Verify alert was fetched
    expect(mockSupabase.from).toHaveBeenCalledWith('alerts');

    // Verify Slack webhook was called
    expect(fetch).toHaveBeenCalledWith(
      mockAlert.alert_channels.slack_webhook_url,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    );

    // Verify payload structure
    const payload = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      text: expect.stringContaining(mockAlert.alert_type),
      blocks: expect.arrayContaining([
        expect.objectContaining({
          type: 'header',
          text: expect.objectContaining({
            text: expect.stringContaining(mockAlert.alert_type),
          }),
        }),
        expect.objectContaining({
          type: 'section',
          text: expect.objectContaining({
            text: mockAlert.message,
          }),
        }),
      ]),
    });

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
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify response is 204 No Content
    expect(response.status).toBe(204);

    // Verify fetch was not called
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return 204 if alert has no Slack webhook URL', async () => {
    // Mock alert with no webhook URL
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: { ...mockAlert, alert_channels: { slack_webhook_url: null } },
        error: null,
      }),
    });

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify response is 204 No Content
    expect(response.status).toBe(204);

    // Verify fetch was not called
    expect(fetch).not.toHaveBeenCalled();
  });
});
