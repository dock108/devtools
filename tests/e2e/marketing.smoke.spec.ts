import { test, expect } from '@playwright/test';

const routes = ['/', '/stripe-guardian'];

for (const route of routes) {
  test(`page loads – ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveTitle(/Dock108/i);
    // basic content check
    await expect(page.locator('body')).not.toHaveText(/404|Error/i);
  });
}

test('page loads – /guardian-demo with static scenarios', async ({ page }) => {
  await page.goto('/guardian-demo');
  await expect(page).toHaveTitle(/Dock108/i);
  // basic content check
  await expect(page.locator('body')).not.toHaveText(/404|Error/i);

  // Check for scenario dropdown
  const scenarioSelect = page.locator('#scenario-select');
  await expect(scenarioSelect).toBeVisible({ timeout: 5000 });
  await expect(scenarioSelect).toHaveValue('velocity-breach'); // Default value

  // Check for event table and default event count (velocity-breach = 12 events)
  // Assuming EventTable renders rows or items we can count
  const eventTable = page.locator('table'); // Adjust selector if needed
  await expect(eventTable.locator('tbody > tr')).toHaveCount(12, { timeout: 5000 });

  // Change scenario to 'bank-swap' (High traffic)
  await scenarioSelect.selectOption({ value: 'bank-swap' });
  await expect(scenarioSelect).toHaveValue('bank-swap');

  // Check event count updates (bank-swap = 10 events)
  await expect(eventTable.locator('tbody > tr')).toHaveCount(10, { timeout: 5000 });

  // Change scenario to 'geo-mismatch' (Low traffic)
  // Add count check if needed, assuming geo-mismatch count is known
  await scenarioSelect.selectOption({ value: 'geo-mismatch' });
  await expect(scenarioSelect).toHaveValue('geo-mismatch');
  // Example: await expect(eventTable.locator('tbody > tr')).toHaveCount(X, { timeout: 5000 });
});

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

test('page loads – /guardian-demo with interactive simulation', async ({ page }) => {
  await page.goto('/guardian-demo');
  await expect(page).toHaveTitle(/Dock108/i);
  // basic content check
  await expect(page.locator('body')).not.toHaveText(/404|Error/i);

  // Check for scenario dropdown and initial state
  const scenarioSelect = page.locator('#scenario-select');
  await expect(scenarioSelect).toBeVisible({ timeout: 5000 });
  await expect(scenarioSelect).toHaveValue('velocity-breach'); // Default value
  await expect(scenarioSelect).toBeDisabled(); // Should be disabled initially
  await expect(page.locator(':text("(Scenario switch locked for 45s)")')).toBeVisible();

  // Check for event table and initial events appearing
  const eventTableBody = page.locator('table tbody');
  await expect(eventTableBody.locator('tr')).toHaveCount(1, { timeout: 3000 }); // Wait for first event (rate is 2s)

  // Use fake timers
  await page.evaluate(() => {
    (window as any).clock = Date.now();
  });
  const tick = async (ms: number) => {
    await page.evaluate((ms) => {
      (window as any).clock += ms;
    }, ms);
    // Need playwright equivalent of cy.tick()
    // Playwright doesn't have a built-in cy.tick(). We might need to rely on waitFor or polling.
    // For now, we'll use timeouts, but this is less reliable than cy.tick().
    await page.waitForTimeout(100); // Small wait to allow state updates
  };

  // Verify more events appear over time (before 45s)
  await page.waitForTimeout(4000); // Wait ~2 more events for velocity-breach (2s rate)
  await expect(eventTableBody.locator('tr')).toHaveCount(3, { timeout: 1000 });

  // Verify dropdown still disabled just before 45s
  // (Need playwright equivalent of checking elapsed time or use hard waits)
  // Cannot reliably test the exact 44s mark without cy.tick()

  // Wait for the 45s lock to expire
  await expect(scenarioSelect).toBeEnabled({ timeout: 46000 }); // Wait up to 46s total
  await expect(page.locator(':text("(Scenario switch locked for 45s)")')).not.toBeVisible();

  // Change scenario to 'bank-swap' (High traffic - 1.5s rate)
  await scenarioSelect.selectOption({ value: 'bank-swap' });
  await expect(scenarioSelect).toHaveValue('bank-swap');
  await expect(eventTableBody.locator('tr')).toHaveCount(0, { timeout: 1000 }); // Should clear table on load

  // Check event count updates faster (bank-swap = 1.5s rate)
  await expect(eventTableBody.locator('tr')).toHaveCount(1, { timeout: 2500 }); // Wait for first event
  await page.waitForTimeout(3000); // Wait for ~2 more events
  await expect(eventTableBody.locator('tr')).toHaveCount(3, { timeout: 1000 });
});
