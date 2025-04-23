import { test, expect, Page } from '@playwright/test';

test.describe('Stripe Guardian Alerts Dashboard', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login first (adjust based on your actual login flow)
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForURL('**/dashboard');
  });

  test('should load alerts dashboard', async () => {
    // Navigate to alerts page
    await page.goto('/stripe-guardian/alerts');
    
    // Check that the page loads correctly
    await expect(page.locator('h1')).toContainText('Stripe Guardian Alerts');
    
    // Check that the tabs are present
    await expect(page.locator('button', { hasText: 'Unresolved' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Resolved' })).toBeVisible();
    
    // Check that the auto-pause toggle is present
    await expect(page.locator('span', { hasText: 'Auto-pause payouts on critical alerts' })).toBeVisible();
  });

  test('should toggle auto-pause setting', async () => {
    await page.goto('/stripe-guardian/alerts');
    
    // Get the current state of the switch
    const switchElement = page.locator('button[role="switch"]');
    const initialState = await switchElement.getAttribute('data-state');
    
    // Click the switch to toggle it
    await switchElement.click();
    
    // Verify the state changed
    const newState = await switchElement.getAttribute('data-state');
    expect(newState).not.toEqual(initialState);
    
    // Verify the toast appears
    await expect(page.locator('div[role="status"]')).toBeVisible();
  });

  test('should mark alert as resolved', async () => {
    await page.goto('/stripe-guardian/alerts');
    
    // Check if we have any unresolved alerts
    const unresolvedTab = page.locator('button[role="tab"]', { hasText: 'Unresolved' });
    await unresolvedTab.click();
    
    const noAlertsMessage = page.locator('text=🎉 No open alerts');
    
    // Skip test if no alerts are present
    if (await noAlertsMessage.isVisible()) {
      test.skip();
      return;
    }
    
    // Count initial number of rows
    const initialRowCount = await page.locator('table tbody tr').count();
    expect(initialRowCount).toBeGreaterThan(0);
    
    // Click the resolve button on the first alert
    await page.locator('table tbody tr').first().locator('button', { hasText: 'Resolve' }).click();
    
    // Wait for success toast
    await expect(page.locator('div[role="status"]', { hasText: 'Alert marked as resolved' })).toBeVisible();
    
    // Verify row is removed or table is updated
    const newRowCount = await page.locator('table tbody tr').count();
    expect(newRowCount).toBeLessThan(initialRowCount);
    
    // Check that it appears in the resolved tab
    await page.locator('button[role="tab"]', { hasText: 'Resolved' }).click();
    
    // Wait for tab content to update
    await page.waitForTimeout(500);
    
    // Verify the alert is now in the resolved tab
    const resolvedAlerts = await page.locator('table tbody tr').count();
    expect(resolvedAlerts).toBeGreaterThan(0);
  });
}); 