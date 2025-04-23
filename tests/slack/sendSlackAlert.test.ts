import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock Stripe
jest.mock('stripe');

// Mock the fetch API
global.fetch = jest.fn();

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
    stripe_payout_id: 'po_test123',
    alert_channels: {
      slack_webhook_url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      auto_pause: false,
    },
    auto_pause: false,
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
      update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: mockAlert,
        error: null,
      }),
    }),
  };

  // Mock Stripe responses
  const mockStripeAdmin = {
    payouts: {
      update: jest.fn().mockResolvedValue({ id: 'po_test123', metadata: { guardian_paused: '1' } }),
    },
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (Stripe as unknown as jest.Mock).mockImplementation(() => mockStripeAdmin);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ ok: true }),
    });

    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should pop a notification, fetch the alert, and send a slack message', async () => {
    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify RPC was called to pop a notification
    expect(mockSupabase.rpc).toHaveBeenCalledWith('pop_notification');

    // Verify alert was fetched
    expect(mockSupabase.from).toHaveBeenCalledWith('alerts');

    // Verify fetch was called with the webhook URL
    expect(global.fetch).toHaveBeenCalledWith(
      mockAlert.alert_channels.slack_webhook_url,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      }),
    );

    // Verify Stripe was not called for auto-pause
    expect(mockStripeAdmin.payouts.update).not.toHaveBeenCalled();

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(expect.objectContaining({
      success: true,
      autoPauseStatus: 'skipped',
    }));
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
    const responseData = await response.json();
    expect(responseData).toEqual(expect.objectContaining({
      message: 'queue empty',
    }));

    // Verify fetch was not called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return 204 if alert has no slack webhook URL', async () => {
    // Mock alert with no slack webhook
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
    const responseData = await response.json();
    expect(responseData).toEqual(expect.objectContaining({
      message: 'no webhook',
    }));

    // Verify fetch was not called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should auto-pause payout when enabled and update the alert to resolved', async () => {
    // Mock alert with auto-pause enabled
    const autoPauseAlert = {
      ...mockAlert,
      auto_pause: true,
      alert_channels: {
        ...mockAlert.alert_channels,
        auto_pause: true,
      },
    };

    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: autoPauseAlert,
        error: null,
      }),
    });

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify Stripe was called to pause the payout
    expect(mockStripeAdmin.payouts.update).toHaveBeenCalledWith(
      autoPauseAlert.stripe_payout_id,
      { metadata: { guardian_paused: '1' } }
    );

    // Verify alert was marked as resolved
    expect(mockSupabase.from).toHaveBeenCalledWith('alerts');
    expect(mockSupabase.from().update).toHaveBeenCalledWith({ resolved: true });
    expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('id', autoPauseAlert.id);

    // Verify Slack message included auto-pause success message
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const slackPayload = JSON.parse(fetchCall[1].body);
    expect(slackPayload.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.objectContaining({
            text: expect.stringContaining('Payout po_test123 has been automatically paused'),
          }),
        }),
      ])
    );

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(expect.objectContaining({
      success: true,
      autoPauseStatus: 'success',
    }));
  });

  it('should handle auto-pause failure gracefully', async () => {
    // Mock alert with auto-pause enabled
    const autoPauseAlert = {
      ...mockAlert,
      auto_pause: true,
      alert_channels: {
        ...mockAlert.alert_channels,
        auto_pause: true,
      },
    };

    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnValue({
        data: autoPauseAlert,
        error: null,
      }),
    });

    // Mock Stripe error
    mockStripeAdmin.payouts.update.mockRejectedValueOnce(new Error('Stripe API error'));

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify Stripe was called to pause the payout but failed
    expect(mockStripeAdmin.payouts.update).toHaveBeenCalledWith(
      autoPauseAlert.stripe_payout_id,
      { metadata: { guardian_paused: '1' } }
    );

    // Verify alert was NOT marked as resolved
    expect(mockSupabase.from).not.toHaveBeenCalledWith(
      expect.arrayContaining(['alerts'])
    );

    // Verify Slack message included auto-pause failure warning
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const slackPayload = JSON.parse(fetchCall[1].body);
    expect(slackPayload.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.objectContaining({
            text: expect.stringContaining('⚠ Failed to auto-pause payout'),
          }),
        }),
      ])
    );

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toEqual(expect.objectContaining({
      success: true,
      autoPauseStatus: 'failed',
    }));
  });

  it('should handle fetch errors', async () => {
    // Mock fetch error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    // Import the handler function
    const { default: handler } = require('@/api/tasks/send-slack-alert');

    // Call the handler function
    const response = await handler();

    // Verify error response
    expect(response.status).toBe(500);
  });
});
