import { test, expect, describe, beforeAll, afterAll, afterEach } from 'vitest';
import nock from 'nock';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EdgeRuntime } from 'edge-runtime'; // To simulate the Deno edge environment
import * as fs from 'fs/promises';
import * as path from 'path';

// --- Test Setup --- //

const MOCK_SUPABASE_URL = 'http://localhost:54321'; // Mock Supabase URL
const MOCK_SUPABASE_KEY = 'mock-service-role-key';
const MOCK_SENDGRID_KEY = 'mock-sendgrid-key';
const MOCK_FROM_EMAIL = 'test@example.com';
const MOCK_SLACK_WEBHOOK =
  'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
const MOCK_ALERT_EMAIL_TO = 'alerts@example.com';

// Mock Supabase client
// let supabase: SupabaseClient;

describe('Guardian Notify Edge Function (tests/notify.spec.ts)', () => {
  let runtime: EdgeRuntime;
  let notifyFunctionCode: string;

  beforeAll(async () => {
    // Set mock environment variables for the edge runtime
    process.env['SUPABASE_URL'] = MOCK_SUPABASE_URL;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = MOCK_SUPABASE_KEY;
    process.env['SENDGRID_API_KEY'] = MOCK_SENDGRID_KEY;
    process.env['FROM_EMAIL'] = MOCK_FROM_EMAIL;
    process.env['SLACK_DEFAULT_USERNAME'] = 'GuardianTest';

    // Read the edge function code
    const functionPath = path.resolve(__dirname, '../supabase/functions/guardian-notify/index.ts');
    try {
      notifyFunctionCode = await fs.readFile(functionPath, 'utf-8');
      // Basic check to ensure file content looks like code
      if (!notifyFunctionCode || notifyFunctionCode.length < 100) {
        throw new Error('Failed to read valid function code or file is too small.');
      }
      console.log('Successfully read guardian-notify function code for testing.');
    } catch (err) {
      console.error('Error reading guardian-notify function file:', err);
      throw new Error(
        `Could not load function code from ${functionPath}. Ensure the path is correct relative to the test file and the file exists.`,
      );
    }

    // Initialize mock Supabase client for test setup/assertions if needed
    // Note: The edge function itself uses its own client instance based on env vars
    // supabase = createClient(MOCK_SUPABASE_URL, MOCK_SUPABASE_KEY);

    // Initialize EdgeRuntime with environment variables
    runtime = new EdgeRuntime({
      extend: (context: any) => {
        context.env = {
          SUPABASE_URL: MOCK_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: MOCK_SUPABASE_KEY,
          SENDGRID_API_KEY: MOCK_SENDGRID_KEY,
          FROM_EMAIL: MOCK_FROM_EMAIL,
          SLACK_DEFAULT_USERNAME: 'GuardianTest',
        };
        // Mock fetch if needed for internal calls within the runtime, though nock handles external ones
        // context.fetch = fetch;
        return context;
      },
      initialCode: notifyFunctionCode,
    });

    // Nock setup for external calls
    if (!nock.isActive()) {
      nock.activate();
    }
    nock.disableNetConnect(); // Prevent accidental real network requests
    // Allow Supabase connections (adjust if using different mock server)
    nock.enableNetConnect((host) => host.includes('localhost:54321'));
    // Allow Slack and SendGrid mocks
    nock.enableNetConnect(
      (host) => host.includes('hooks.slack.com') || host.includes('api.sendgrid.com'),
    );
  });

  afterEach(() => {
    nock.cleanAll(); // Clean mocks between tests
  });

  afterAll(() => {
    nock.restore(); // Restore nock
    nock.enableNetConnect(); // Re-enable network connections
    runtime?.dispose(); // Dispose of the edge runtime
    process.env['SUPABASE_URL'] = undefined;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = undefined;
    process.env['SENDGRID_API_KEY'] = undefined;
    process.env['FROM_EMAIL'] = undefined;
    process.env['SLACK_DEFAULT_USERNAME'] = undefined;
  });

  // --- Test Cases --- //

  test('should send email for free tier account below limit', async () => {
    const alertId = 'alert-free-1';
    const accountId = 'acct_free_1';

    // Mock Supabase responses
    nock(MOCK_SUPABASE_URL)
      .post(
        '/rest/v1/alerts?select=id%2Cstripe_account_id%2Ctype%2Cseverity%2Cdescription%2Ctriggered_at&id=eq.alert-free-1',
      )
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'charge.failed',
          severity: 'high',
          description: 'Test charge failed',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post('/rest/v1/settings?select=id%2Ctier%2Cemail_to%2Cslack_webhook&limit=1') // Assuming global settings
      .reply(200, [
        {
          id: 'global-settings-id',
          tier: 'free',
          email_to: MOCK_ALERT_EMAIL_TO,
          slack_webhook: null,
        },
      ])
      .head('/rest/v1/alerts?select=id&stripe_account_id=eq.acct_free_1') // Mock count check
      .reply(200, undefined, { 'content-range': '0-9/10' }); // Simulate count = 10

    // Mock SendGrid call
    const sendgridScope = nock('https://api.sendgrid.com').post('/v3/mail/send').reply(202); // SendGrid returns 202 Accepted

    // Execute the edge function
    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    // Assertions
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.alert_id).toBe(alertId);
    expect(sendgridScope.isDone()).toBe(true); // Check SendGrid was called
    // Ensure Slack was not called (implicitly checked by nock cleanAll if no Slack mock is defined)
  });

  test('should NOT send email for free tier account at/above limit', async () => {
    const alertId = 'alert-free-51';
    const accountId = 'acct_free_2';

    // Mock Supabase responses
    nock(MOCK_SUPABASE_URL)
      .post(
        '/rest/v1/alerts?select=id%2Cstripe_account_id%2Ctype%2Cseverity%2Cdescription%2Ctriggered_at&id=eq.alert-free-51',
      )
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'charge.dispute.created',
          severity: 'critical',
          description: 'Test dispute',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post('/rest/v1/settings?select=id%2Ctier%2Cemail_to%2Cslack_webhook&limit=1')
      .reply(200, [
        {
          id: 'global-settings-id',
          tier: 'free',
          email_to: MOCK_ALERT_EMAIL_TO,
          slack_webhook: null,
        },
      ])
      .head('/rest/v1/alerts?select=id&stripe_account_id=eq.acct_free_2')
      .reply(200, undefined, { 'content-range': '0-50/51' }); // Simulate count = 51 (>= 50)

    // Mock SendGrid (but expect it NOT to be called)
    const sendgridScope = nock('https://api.sendgrid.com').post('/v3/mail/send').reply(202);

    // Execute the edge function
    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    // Assertions
    expect(response.status).toBe(200); // Function returns 200 but indicates skipped
    const body = await response.json();
    expect(body.message).toBe('Free tier limit reached');
    expect(sendgridScope.isDone()).toBe(false); // Check SendGrid was NOT called
  });

  test('should send email and Slack for pro tier account', async () => {
    const alertId = 'alert-pro-1';
    const accountId = 'acct_pro_1';

    // Mock Supabase responses
    nock(MOCK_SUPABASE_URL)
      .post(
        '/rest/v1/alerts?select=id%2Cstripe_account_id%2Ctype%2Cseverity%2Cdescription%2Ctriggered_at&id=eq.alert-pro-1',
      )
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'payout.failed',
          severity: 'medium',
          description: 'Test payout failed',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post('/rest/v1/settings?select=id%2Ctier%2Cemail_to%2Cslack_webhook&limit=1')
      .reply(200, [
        {
          id: 'global-settings-id',
          tier: 'pro',
          email_to: MOCK_ALERT_EMAIL_TO,
          slack_webhook: MOCK_SLACK_WEBHOOK,
        },
      ]);
    // No count check needed for pro tier

    // Mock SendGrid call
    const sendgridScope = nock('https://api.sendgrid.com').post('/v3/mail/send').reply(202);

    // Mock Slack call
    const slackScope = nock('https://hooks.slack.com')
      .post(/services\/T00000000\/B00000000\/.*/)
      .reply(200, 'ok');

    // Execute the edge function
    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    // Assertions
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(sendgridScope.isDone()).toBe(true); // Check SendGrid was called
    expect(slackScope.isDone()).toBe(true); // Check Slack was called
  });

  test('should handle alert not found', async () => {
    const alertId = 'alert-not-found';

    nock(MOCK_SUPABASE_URL)
      .post(/rest\/v1\/alerts.*id=eq.alert-not-found/)
      .reply(404, { message: 'Alert not found' }); // Or reply with empty array for 404

    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Alert not found');
  });

  test('should handle settings not found', async () => {
    const alertId = 'alert-no-settings';
    const accountId = 'acct_no_settings';

    nock(MOCK_SUPABASE_URL)
      .post(/rest\/v1\/alerts.*id=eq.alert-no-settings/)
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'test',
          severity: 'low',
          description: 'desc',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post(/rest\/v1\/settings/)
      .reply(404, { message: 'Settings not found' }); // Or reply with empty array

    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    expect(response.status).toBe(500); // Function treats this as internal error
    const body = await response.json();
    expect(body.error).toBe('Settings not found');
  });

  test('should handle invalid request body', async () => {
    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrong_param: 'some-id' }), // Missing alert_id
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
    expect(body.details).toContain('Missing or invalid alert_id');
  });

  test('should handle SendGrid API error gracefully', async () => {
    const alertId = 'alert-sendgrid-fail';
    const accountId = 'acct_sendgrid_fail';

    // Mock Supabase responses
    nock(MOCK_SUPABASE_URL)
      .post(/rest\/v1\/alerts.*id=eq.alert-sendgrid-fail/)
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'charge.failed',
          severity: 'high',
          description: 'Test fail',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post(/rest\/v1\/settings/)
      .reply(200, [
        {
          id: 'global-settings-id',
          tier: 'pro',
          email_to: MOCK_ALERT_EMAIL_TO,
          slack_webhook: MOCK_SLACK_WEBHOOK,
        },
      ]);

    // Mock SendGrid failure
    const sendgridScope = nock('https://api.sendgrid.com')
      .post('/v3/mail/send')
      .reply(500, { errors: ['SendGrid internal error'] });
    // Mock Slack success (should still be called)
    const slackScope = nock('https://hooks.slack.com')
      .post(/services\/.*/)
      .reply(200, 'ok');

    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    expect(response.status).toBe(200); // Function completes successfully
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(sendgridScope.isDone()).toBe(true); // SendGrid was attempted
    expect(slackScope.isDone()).toBe(true); // Slack was still called
    // Check logs for error message (can't directly test console.error easily here)
  });

  test('should handle Slack API error gracefully', async () => {
    const alertId = 'alert-slack-fail';
    const accountId = 'acct_slack_fail';

    // Mock Supabase responses
    nock(MOCK_SUPABASE_URL)
      .post(/rest\/v1\/alerts.*id=eq.alert-slack-fail/)
      .reply(200, [
        {
          id: alertId,
          stripe_account_id: accountId,
          type: 'charge.failed',
          severity: 'high',
          description: 'Test fail',
          triggered_at: new Date().toISOString(),
        },
      ])
      .post(/rest\/v1\/settings/)
      .reply(200, [
        {
          id: 'global-settings-id',
          tier: 'pro',
          email_to: MOCK_ALERT_EMAIL_TO,
          slack_webhook: MOCK_SLACK_WEBHOOK,
        },
      ]);

    // Mock SendGrid success
    const sendgridScope = nock('https://api.sendgrid.com').post('/v3/mail/send').reply(202);
    // Mock Slack failure
    const slackScope = nock('https://hooks.slack.com')
      .post(/services\/.*/)
      .reply(400, 'invalid_payload');

    const response = await runtime.dispatchFetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });

    expect(response.status).toBe(200); // Function completes successfully
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(sendgridScope.isDone()).toBe(true); // SendGrid was called
    expect(slackScope.isDone()).toBe(true); // Slack was attempted
    // Check logs for error message
  });
});
