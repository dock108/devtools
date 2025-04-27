import { test, expect } from '@playwright/test';

test.describe('Alert Feedback UI', () => {
  const ALERT_DETAIL_PAGE = '/stripe-guardian/alerts/some-alert-id'; // Replace with a valid test alert ID

  test.beforeEach(async ({ page }) => {
    // TODO: Implement authentication flow (e.g., login via UI or set auth cookie/token)
    await page.goto(ALERT_DETAIL_PAGE);
    // Wait for feedback section to be potentially visible
    await page.waitForSelector('text=Was this alert correct?');
  });

  test('should allow voting Legit', async ({ page }) => {
    const legitButton = page.getByRole('button', { name: /✅ Legit/i });
    const thankYouMessage = page.getByText('Thank you for your feedback!');
    const changeVoteLink = page.getByRole('button', { name: /Change my vote/i });

    await legitButton.click();

    // Wait for submission and UI update
    await expect(thankYouMessage).toBeVisible();
    await expect(legitButton).not.toBeVisible(); // Original buttons should hide
    await expect(changeVoteLink).toBeVisible();

    // TODO: Optionally verify API call mock or DB state via cy.task if needed
  });

  test('should allow voting False Positive with comment', async ({ page }) => {
    const fpButton = page.getByRole('button', { name: /🚫 False Positive/i });
    const commentTextarea = page.getByPlaceholder(/Optional: Why was this a false positive/i);
    const submitFpButton = page.getByRole('button', { name: 'Submit False Positive Feedback' });
    const thankYouMessage = page.getByText('Thank you for your feedback!');

    await fpButton.click();

    // Textarea should appear
    await expect(commentTextarea).toBeVisible();
    await commentTextarea.fill('Test false positive reason');

    await submitFpButton.click();

    // Wait for submission and UI update
    await expect(thankYouMessage).toBeVisible();
    await expect(fpButton).not.toBeVisible();
    await expect(commentTextarea).not.toBeVisible();
    await expect(submitFpButton).not.toBeVisible();
  });

  test('should allow changing vote after submitting', async ({ page }) => {
    const legitButton = page.getByRole('button', { name: /✅ Legit/i });
    const fpButton = page.getByRole('button', { name: /🚫 False Positive/i });
    const thankYouMessage = page.getByText('Thank you for your feedback!');
    const changeVoteLink = page.getByRole('button', { name: /Change my vote/i });

    // Initial vote: Legit
    await legitButton.click();
    await expect(thankYouMessage).toBeVisible();

    // Click change vote
    await changeVoteLink.click();

    // Original buttons should reappear
    await expect(thankYouMessage).not.toBeVisible();
    await expect(legitButton).toBeVisible();
    await expect(fpButton).toBeVisible();

    // Change vote to FP
    await fpButton.click();
    const submitFpButton = page.getByRole('button', { name: 'Submit False Positive Feedback' });
    await expect(submitFpButton).toBeVisible();
    await submitFpButton.click(); // Submit FP without comment for this test

    // Check final state
    await expect(thankYouMessage).toBeVisible();
    await expect(submitFpButton).not.toBeVisible();
    await expect(changeVoteLink).toBeVisible();
  });
});
