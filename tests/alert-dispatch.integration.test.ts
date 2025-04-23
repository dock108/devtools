import { jest } from '@jest/globals';
import fetchMock from 'jest-fetch-mock';
import nock from 'nock';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Mock the Edge API handlers
jest.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
  serve: (handler: Function) => handler,
}));

// Import the Edge Function handlers directly
import slackAlertHandler from '../supabase/functions/send-slack-alert/index';
import emailAlertHandler from '../supabase/functions/send-email-alert/index';

// Set up mocks
fetchMock.enableMocks();
jest.mock('stripe');

// Mock Deno.env.get for Edge Functions
global.Deno = {
  env: {
    get: (key: string) => {
      const envVars: Record<string, string> = {
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'mock-stripe-key',
        RESEND_API_KEY: process.env.RESEND_API_KEY || 'mock-resend-key',
      };
      return envVars[key];
    },
  },
} as any;

describe('Alert Dispatch Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>;
  let mockStripeAdmin: jest.Mocked<Stripe>;
  
  // Constants for test scenarios
  const TEST_ACCOUNT_ID = 'acct_test123456789';
  const TEST_PAYOUT_ID = 'po_test123456789';
  const TEST_SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
  const TEST_EMAIL = 'alerts@example.com';
  const TEST_ALERT_TYPE = 'VELOCITY';
  const TEST_ALERT_MESSAGE = 'Suspicious velocity breach detected';
  
  beforeAll(() => {
    // Create Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL || 'https://example.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key'
    );
    
    // Mock Stripe
    mockStripeAdmin = new Stripe('mock-key') as jest.Mocked<Stripe>;
    mockStripeAdmin.payouts = {
      update: jest.fn().mockResolvedValue({ id: TEST_PAYOUT_ID, metadata: { guardian_paused: '1' } }),
    } as any;
    
    // Override Stripe constructor to return our mock
    (Stripe as unknown as jest.Mock).mockImplementation(() => mockStripeAdmin);
  });
  
  beforeEach(() => {
    // Reset mocks before each test
    fetchMock.resetMocks();
    jest.clearAllMocks();
    nock.cleanAll();
    
    // Set up Resend API mock
    nock('https://api.resend.com')
      .post('/emails')
      .reply(200, { id: 'mock-email-id' });
  });
  
  afterAll(async () => {
    // Clean up test data
    await supabase.from('pending_notifications').delete().eq('alert_id', 'test');
    await supabase.from('alerts').delete().eq('id', 'test');
    await supabase.from('alert_channels').delete().eq('stripe_account_id', TEST_ACCOUNT_ID);
  });
  
  async function setupTestScenario({
    slackEnabled = false,
    emailEnabled = false,
    autoPauseEnabled = false,
  }) {
    // 1. Set up alert channels
    await supabase.from('alert_channels').upsert({
      stripe_account_id: TEST_ACCOUNT_ID,
      slack_webhook_url: slackEnabled ? TEST_SLACK_WEBHOOK : null,
      email_to: emailEnabled ? TEST_EMAIL : null,
      auto_pause: autoPauseEnabled,
    });
    
    // 2. Create test alert
    const { data: alert } = await supabase.from('alerts').upsert({
      id: 'test-alert-id',
      alert_type: TEST_ALERT_TYPE,
      severity: 'high',
      message: TEST_ALERT_MESSAGE,
      stripe_payout_id: TEST_PAYOUT_ID,
      stripe_account_id: TEST_ACCOUNT_ID,
      resolved: false,
      auto_pause: autoPauseEnabled,
    }).select().single();
    
    // 3. Add to notification queue
    await supabase.from('pending_notifications').insert({
      alert_id: alert.id,
      processed: false,
    });
    
    return { alertId: alert.id };
  }
  
  test('Scenario 1: Slack only - should send Slack message without email or auto-pause', async () => {
    // Setup: Slack enabled, no email, no auto-pause
    const { alertId } = await setupTestScenario({
      slackEnabled: true,
      emailEnabled: false,
      autoPauseEnabled: false,
    });
    
    // Create mock request for the Edge Function
    const mockRequest = new Request('https://example.com/send-slack-alert', {
      method: 'POST',
    });
    
    // Execute the Slack alert handler
    const response = await slackAlertHandler(mockRequest);
    
    // Assertions
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe(TEST_SLACK_WEBHOOK);
    
    // Verify Stripe wasn't called to pause payout
    expect(mockStripeAdmin.payouts.update).not.toHaveBeenCalled();
    
    // Verify alert wasn't marked as resolved
    const { data: alert } = await supabase
      .from('alerts')
      .select('resolved')
      .eq('id', alertId)
      .single();
    
    expect(alert.resolved).toBe(false);
  });
  
  test('Scenario 2: Email only - should send email without Slack or auto-pause', async () => {
    // Setup: Email enabled, no Slack, no auto-pause
    const { alertId } = await setupTestScenario({
      slackEnabled: false,
      emailEnabled: true,
      autoPauseEnabled: false,
    });
    
    // Set up Resend API mock
    const resendMock = nock('https://api.resend.com')
      .post('/emails')
      .reply(200, { id: 'mock-email-id' });
    
    // Create mock request for the Edge Function
    const mockRequest = new Request('https://example.com/send-email-alert', {
      method: 'POST',
    });
    
    // Execute the Email alert handler
    const response = await emailAlertHandler(mockRequest);
    
    // Assertions
    expect(response.status).toBe(200);
    expect(resendMock.isDone()).toBe(true); // Verify Resend API was called
    
    // Verify Slack wasn't called
    expect(fetchMock.mock.calls.length).toBe(0);
    
    // Verify Stripe wasn't called to pause payout
    expect(mockStripeAdmin.payouts.update).not.toHaveBeenCalled();
    
    // Verify alert wasn't marked as resolved
    const { data: alert } = await supabase
      .from('alerts')
      .select('resolved')
      .eq('id', alertId)
      .single();
    
    expect(alert.resolved).toBe(false);
  });
  
  test('Scenario 3: Both channels with auto-pause - should send Slack, email, and pause payout', async () => {
    // Setup: Both Slack and Email enabled, with auto-pause
    const { alertId } = await setupTestScenario({
      slackEnabled: true,
      emailEnabled: true,
      autoPauseEnabled: true,
    });
    
    // Set up Resend API mock
    const resendMock = nock('https://api.resend.com')
      .post('/emails')
      .reply(200, { id: 'mock-email-id' });
    
    // Create mock requests for the Edge Functions
    const slackRequest = new Request('https://example.com/send-slack-alert', {
      method: 'POST',
    });
    
    const emailRequest = new Request('https://example.com/send-email-alert', {
      method: 'POST',
    });
    
    // Execute both handlers
    const slackResponse = await slackAlertHandler(slackRequest);
    const emailResponse = await emailAlertHandler(emailRequest);
    
    // Assertions
    expect(slackResponse.status).toBe(200);
    expect(emailResponse.status).toBe(200);
    
    // Verify Slack was called
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe(TEST_SLACK_WEBHOOK);
    
    // Verify Resend API was called
    expect(resendMock.isDone()).toBe(true);
    
    // Verify Stripe was called to pause payout
    expect(mockStripeAdmin.payouts.update).toHaveBeenCalledWith(
      TEST_PAYOUT_ID,
      { metadata: { guardian_paused: '1' } }
    );
    
    // Verify alert was marked as resolved
    const { data: alert } = await supabase
      .from('alerts')
      .select('resolved')
      .eq('id', alertId)
      .single();
    
    expect(alert.resolved).toBe(true);
  });
}); 