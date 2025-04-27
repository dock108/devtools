import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('DOCK108 Devtools'); // Adjust text as needed
  });

  test('Stripe Guardian page loads', async ({ page }) => {
    await page.goto('/stripe-guardian');
    await expect(page.locator('h1')).toContainText('Stripe Guardian'); // Adjust text as needed
  });

  // Add other smoke tests as needed...
});

test.describe('Feed Tests', () => {
  test('RSS feed is accessible and has correct content type', async ({ request }) => {
    const response = await request.get('/feed.xml');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    // RSS feeds might be application/rss+xml or application/xml or text/xml
    expect(contentType).toMatch(/xml/);
    // Optional: Check if the body contains expected XML structure
    const body = await response.text();
    expect(body).toContain('<rss'); // Or <feed> if Atom
    expect(body).toContain('<channel>'); // Or similar top-level element
    expect(body).toContain('<item>'); // Or <entry> for Atom
  });
});
