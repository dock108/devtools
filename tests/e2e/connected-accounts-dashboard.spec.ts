import { test, expect } from '@playwright/test';

// TODO: Add helper for login if needed
// import { login } from '../utils/auth';

test.describe.skip('Connected Accounts Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/accounts');
    // await login(page); // Ensure user is logged in
    // Mock API response for /api/accounts if needed for consistent state
  });

  test('should display connected accounts in a table/cards', async ({ page }) => {
    // Verify account names/IDs are visible
    await expect(page.getByText('acct_123')).toBeVisible(); // Assuming mock data or seeded account
    await expect(page.getByText('acct_456')).toBeVisible();
    // Check for table headers or card structure
  });

  test('should disable Add Account button when limit (2) is reached', async ({ page }) => {
    // Assume test setup ensures 2 accounts are displayed
    await expect(page.getByRole('button', { name: /Add Stripe Account/i })).toBeDisabled();
    // TODO: Verify tooltip text
  });

  test('should initiate Stripe connect flow when Add Account is clicked (if limit not reached)', async ({
    page,
  }) => {
    // Setup: ensure only 0 or 1 account is displayed
    // TODO: Implement mock/setup for < 2 accounts
    const connectButton = page.getByRole('button', { name: /Add Stripe Account/i });
    await expect(connectButton).toBeEnabled();
    // Click doesn't work directly with page changes, need to assert navigation occurs
    // await connectButton.click();
    // await expect(page).toHaveURL(/connect.stripe.com/); // Or check for the server action call
    await expect(page.getByText('Not Implemented Yet')).toBeVisible(); // Placeholder
  });

  test('should open disconnect confirmation dialog', async ({ page }) => {
    // Find the disconnect button for a specific account (e.g., using data-testid or nested selectors)
    const disconnectButton = page
      .locator('tr:has-text("acct_123") button[aria-label*="Disconnect"]')
      .first();
    await disconnectButton.click();
    await expect(page.getByRole('heading', { name: /Disconnect acct_123?/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  });

  test('should disconnect account when confirmed', async ({ page }) => {
    // Mock the DELETE /api/accounts/[id] endpoint to return success
    // TODO: Add API mocking
    const disconnectButton = page
      .locator('tr:has-text("acct_123") button[aria-label*="Disconnect"]')
      .first();
    await disconnectButton.click();
    await page.getByRole('button', { name: 'Disconnect' }).click();
    // Verify toast message appears
    await expect(page.getByText(/Account acct_123 disconnected/i)).toBeVisible();
    // Verify account row is now disabled/grayed out or removed (based on optimistic update/refresh)
    await expect(page.locator('tr:has-text("acct_123")')).toHaveClass(/opacity-50/); // Check for optimistic style
  });

  test('admin should see and be able to change rule set', async ({ page }) => {
    // Setup: Ensure user is logged in as admin
    // TODO: Implement admin login/session setup
    // Mock /api/accounts to return rule set options if needed
    // Mock PATCH /api/accounts/[id]

    const ruleSetSelect = page.locator('tr:has-text("acct_123") select'); // Adjust selector
    await expect(ruleSetSelect).toBeVisible();
    await ruleSetSelect.selectOption({ label: 'High Risk' }); // Or select by value

    // Verify PATCH API call was made
    // TODO: Add API call verification
    // Verify success toast
    await expect(page.getByText(/Rule set updated for acct_123/i)).toBeVisible();
  });

  test('non-admin should see read-only rule set badge', async ({ page }) => {
    // Setup: Ensure user is logged in as non-admin
    // TODO: Implement non-admin login/session setup
    await expect(page.locator('tr:has-text("acct_123") select')).not.toBeVisible();
    await expect(page.locator('tr:has-text("acct_123")').getByText('Default')).toBeVisible();
    await expect(page.locator('tr:has-text("acct_456")').getByText('High Risk')).toBeVisible();
  });

  // TODO: Add tests for backfill progress component display within the table/cards
  // TODO: Add tests for responsive/mobile card view
});
