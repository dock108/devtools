import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import nock from 'nock';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Test user credentials
const TEST_USER_EMAIL = 'test-user@example.com';
const TEST_USER_PASSWORD = 'test-password123';
const TEST_USER_2_EMAIL = 'test-user-2@example.com';
const TEST_USER_2_PASSWORD = 'test-password456';

// Stripe test account ID
const TEST_STRIPE_ACCOUNT_ID = 'acct_test123456789';

// Supabase admin client for verification
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.vI9obAHOGyVVKa3pD--kJlyxp-Z2zV9UUMAhKpNLAcU',
);

// Helper to create test users
async function createTestUser(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data.user;
}

// Helper to delete test data
async function deleteTestData(userId: string) {
  // Delete connected accounts
  await supabaseAdmin.from('connected_accounts').delete().eq('user_id', userId);

  // Delete alert channels
  await supabaseAdmin.from('alert_channels').delete().eq('user_id', userId);

  // Delete payout events
  await supabaseAdmin.from('payout_events').delete().eq('user_id', userId);

  // Delete user
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

test.describe('Stripe OAuth and Webhook Integration', () => {
  let user1Id: string;
  let user2Id: string;

  test.beforeAll(async () => {
    // Create test users
    const user1 = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    const user2 = await createTestUser(TEST_USER_2_EMAIL, TEST_USER_2_PASSWORD);

    user1Id = user1.id;
    user2Id = user2.id;

    // Start the Stripe CLI in the background for webhook forwarding
    try {
      await execPromise('stripe listen --forward-to http://localhost:3000/api/stripe/webhook &');
      console.log('Started Stripe CLI webhook forwarding');
    } catch (error) {
      console.error('Failed to start Stripe CLI:', error);
    }
  });

  test.afterAll(async () => {
    // Clean up test data
    await deleteTestData(user1Id);
    await deleteTestData(user2Id);

    // Kill the Stripe CLI process
    try {
      await execPromise('pkill -f "stripe listen"');
      console.log('Stopped Stripe CLI webhook forwarding');
    } catch (error) {
      console.error('Failed to stop Stripe CLI:', error);
    }
  });

  test('complete OAuth flow, webhook creation, and RLS enforcement', async ({ page, context }) => {
    // Step 1: Set up mocks for OAuth and webhook creation
    nock('https://connect.stripe.com').post('/oauth/token').reply(200, {
      stripe_user_id: TEST_STRIPE_ACCOUNT_ID,
      access_token: 'sk_test_access_token',
      refresh_token: 'rt_test_refresh_token',
      livemode: false,
    });

    nock('https://api.stripe.com').post('/v1/webhook_endpoints').reply(200, {
      id: 'we_123456789',
      secret: 'whsec_test_secret',
      url: 'https://www.dock108.ai/api/stripe/webhook',
    });

    // Step 2: Log in as first user
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for successful login
    await page.waitForNavigation();

    // Step 3: Navigate to onboarding page
    await page.goto('/stripe-guardian/onboard');

    // Save the state parameter from the OAuth URL
    const connectButton = await page.locator('a[href^="/api/stripe/oauth/start"]');
    await connectButton.click();

    // Get the current URL after clicking the button
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const state = urlObj.searchParams.get('state');

    // Intercept the Stripe OAuth page and redirect back with test code
    await page.goto(`/api/stripe/oauth/callback?code=test_auth_code&state=${state}`);

    // Step 4: Verify we land on the accounts page with success message
    await page.waitForURL('**/settings/accounts');

    // Check for the connected badge
    const badge = await page.locator('text=Live Mode, text=Test Mode').first();
    await expect(badge).toBeVisible();

    // Step 5: Verify DB records
    const { data: connectedAccounts } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user1Id)
      .eq('stripe_account_id', TEST_STRIPE_ACCOUNT_ID);

    expect(connectedAccounts).toHaveLength(1);
    expect(connectedAccounts?.[0].webhook_secret).toBe('whsec_test_secret');
    expect(connectedAccounts?.[0].live).toBe(false);

    const { data: alertChannels } = await supabaseAdmin
      .from('alert_channels')
      .select('*')
      .eq('user_id', user1Id)
      .eq('stripe_account_id', TEST_STRIPE_ACCOUNT_ID);

    expect(alertChannels).toHaveLength(1);

    // Step 6: Simulate a payout event
    try {
      await execPromise(`stripe trigger payout.paid --account ${TEST_STRIPE_ACCOUNT_ID}`);
      console.log('Triggered payout.paid event');
    } catch (error) {
      console.error('Failed to trigger payout event:', error);
    }

    // Wait for webhook processing (up to 5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify the payout event was created
    const { data: payoutEvents } = await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', TEST_STRIPE_ACCOUNT_ID);

    expect(payoutEvents).toHaveLength(1);

    // Step 7: Test RLS enforcement - Log in as second user
    const page2 = await context.newPage();
    await page2.goto('/login');
    await page2.fill('input[type="email"]', TEST_USER_2_EMAIL);
    await page2.fill('input[type="password"]', TEST_USER_2_PASSWORD);
    await page2.click('button[type="submit"]');

    // Wait for successful login
    await page2.waitForNavigation();

    // Try to access alerts API for the first user's account
    const apiResponse = await page2.request.get('/api/alerts');
    expect(apiResponse.status()).toBe(200);

    const alertsData = await apiResponse.json();
    expect(alertsData.data).toHaveLength(0); // Should be empty due to RLS

    // Close the second page
    await page2.close();
  });
});
