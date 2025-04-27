import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Homepage loads - contains text "DOCK108 Devtools"', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('DOCK108 Devtools');
  });

  test('Stripe Guardian - loads page', async ({ page }) => {
    await page.goto('/stripe-guardian');
    await expect(page.locator('body')).toContainText('Stripe Guardian');
  });

  test('Blog Footer Snippets are visible on homepage', async ({ page }) => {
    await page.goto('/');

    // Check for the blog footer section
    const blogFooter = page.locator('.border-t >> text=From the Blog');
    await expect(blogFooter).toBeVisible();

    // Check for blog post snippets (should be at least 1, up to 3)
    const snippetCards = page.locator('a[href^="/blog/"]').filter({
      has: page.locator('.group'),
    });

    // Verify we have at least one snippet
    const count = await snippetCards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);

    // Verify each snippet has expected elements
    for (let i = 0; i < count; i++) {
      const card = snippetCards.nth(i);

      // Check title exists and is visible
      await expect(card.locator('h3')).toBeVisible();

      // Check excerpt exists and is visible
      await expect(card.locator('p')).toBeVisible();

      // Check date badge exists and is visible
      await expect(card.locator('.badge')).toBeVisible();

      // Verify it's a working link (has href attribute)
      await expect(card).toHaveAttribute('href', /^\/blog\/.+/);
    }
  });

  // Add other smoke tests as needed...
});

test.describe('Feed Tests', () => {
  test('RSS feed is available', async ({ page }) => {
    const response = await page.goto('/rss/feed.xml');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('application/xml');

    const content = await page.content();
    expect(content).toContain('<rss');
    expect(content).toContain('<channel>');
    expect(content).toContain('<item>');
  });
});
