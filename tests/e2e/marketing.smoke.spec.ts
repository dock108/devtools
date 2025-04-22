import { test, expect } from '@playwright/test';

const routes = ['/', '/stripe-guardian', '/guardian-demo'];

for (const route of routes) {
  test(`page loads – ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveTitle(/Dock108/i);
    // basic content check
    await expect(page.locator('body')).not.toHaveText(/404|Error/i);
  });
} 