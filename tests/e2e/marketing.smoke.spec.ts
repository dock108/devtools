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

test('docs link in header navigates to documentation', async ({ page }) => {
  await page.goto('/');

  // Click on the Docs link in the header
  await page.getByRole('link', { name: 'Docs', exact: true }).click();

  // Check that we navigated to the docs page
  await page.waitForURL('/docs');

  // Verify the docs content loaded
  await expect(page.locator('h1')).toBeVisible();

  // Navigate back and check it works
  await page.goBack();
  await expect(page).toHaveURL('/');
});
