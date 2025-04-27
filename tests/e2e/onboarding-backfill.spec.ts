import { test, expect } from '@playwright/test';

test.describe.skip('Stripe OAuth Onboarding & Backfill Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page where the "Connect Stripe" button is (e.g., sign-up or settings)
    await page.goto('/settings/connected-accounts'); // Adjust as needed
    // Perform login if required
    // await login(page); // Assuming a helper function
  });

  test('should successfully connect the first Stripe account and show backfill progress', async ({
    page,
  }) => {
    // 1. Click the "Connect with Stripe" button
    // 2. Handle the Stripe OAuth redirect flow (potentially mocking the Stripe UI part)
    // 3. Verify redirection back to the app (e.g., /dashboard?connected=success)
    // 4. Navigate to the connected accounts page
    // 5. Verify the new account is listed
    // 6. Verify the BackfillProgress component shows 'Pending' or 'Running' initially
    // 7. (Optional) Wait/poll and verify it reaches 'Completed'
    await expect(page.getByText('Not implemented')).toBeVisible(); // Placeholder
  });

  test('should successfully connect a second Stripe account', async ({ page }) => {
    // Pre-condition: Assume one account is already connected
    // Repeat the connection flow for a second account
    // Verify two accounts are listed
    // Verify backfill status for the second account
    await expect(page.getByText('Not implemented')).toBeVisible(); // Placeholder
  });

  test('should show an error when attempting to connect a third Stripe account', async ({
    page,
  }) => {
    // Pre-condition: Assume two accounts are already connected
    // Click connect button
    // Handle Stripe OAuth redirect
    // Verify redirection back to the app with an error message/toast
    // Verify only two accounts are still listed
    await expect(page.getByText('Not implemented')).toBeVisible(); // Placeholder
  });

  test('should handle OAuth denial from Stripe', async ({ page }) => {
    // Click connect button
    // Mock or trigger the Stripe OAuth flow to return ?error=access_denied
    // Verify redirection back to the app (e.g., /sign-up?error=oAuthDenied)
    // Verify no new account was added
    await expect(page.getByText('Not implemented')).toBeVisible(); // Placeholder
  });

  // Add tests for webhook creation verification (requires Stripe API interaction or mocking)
  // Add tests for backfill job completion/failure impacting the UI status
});
