import { test, expect } from '@playwright/test';

test.describe('Documentation Site', () => {
  test('should render the docs landing page', async ({ page }) => {
    await page.goto('/docs');

    // Check that the page title exists
    await expect(page.locator('h1')).toContainText('Stripe Guardian Documentation');

    // Check that the section headings exist
    await expect(page.locator('h2')).toHaveCount(4); // The number of sections in docs.config.ts

    // Check that the cards exist
    await expect(page.locator('a').filter({ hasText: 'Read more' })).toHaveCount(11); // The total number of links in docs.config.ts
  });

  test('should navigate to a doc page', async ({ page }) => {
    await page.goto('/docs');

    // Click on a doc link
    await page.getByRole('link', { name: 'Getting Started' }).click();

    // Wait for navigation to complete
    await page.waitForURL('/docs/getting-started');

    // Check that the doc content loaded
    await expect(page.locator('h1')).toContainText('Getting Started with Stripe Guardian');

    // Check that the alert component is rendered
    await expect(
      page
        .locator('div')
        .filter({ hasText: 'Stripe Guardian is designed to complement Stripe Radar' }),
    ).toBeVisible();
  });

  test('should toggle mobile drawer', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/docs');

    // The sidebar should be hidden on mobile
    await expect(page.locator('aside').filter({ hasText: 'Getting Started' })).not.toBeVisible();

    // Click the hamburger menu
    await page.getByRole('button', { name: 'Toggle navigation menu' }).click();

    // The sidebar should be visible in the drawer
    await expect(page.locator('nav').filter({ hasText: 'Getting Started' })).toBeVisible();

    // Click on a link in the drawer
    await page.getByRole('link', { name: 'Quick Start' }).click();

    // Wait for navigation to complete
    await page.waitForURL('/docs/getting-started');

    // Check that we navigated to the right page
    await expect(page.locator('h1')).toContainText('Getting Started with Stripe Guardian');
  });
});
