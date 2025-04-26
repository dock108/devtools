/// <reference types="cypress" />

describe('Guardian Dashboard - Real-time Alert Notifications', () => {
  // Define test user and account details (replace with actual test data setup)
  const testUserId = 'your-test-user-uuid'; // Replace with actual test user ID
  const testStripeAccountId = 'acct_test123456'; // Replace with a Stripe account linked to the test user
  let seededAlertId: string | null = null;

  beforeEach(() => {
    // Log in as the test user
    // Assumes a custom command `cy.login()` is configured in cypress/support/commands.ts
    cy.login(testUserId);

    // Clear any existing reads for this potential alert before the test
    // This prevents failures if a previous run didn't clean up
    cy.task('clearAlertReads', { userId: testUserId }).then(() => {
      // Navigate to a page where the Header component is rendered (e.g., homepage)
      cy.visit('/');
      // Ensure the initial state has no badge (optional, but good practice)
      cy.get('[aria-label*="View alerts"] span').should('not.exist');
    });
  });

  afterEach(() => {
    // Clean up: Remove the seeded alert and any reads associated with it
    if (seededAlertId) {
      cy.task('cleanupAlert', { alertId: seededAlertId });
      seededAlertId = null; // Reset for next test
    }
  });

  it('should display a badge and toast on new alert, then clear badge on navigation', () => {
    // 1. Seed an alert via API/task
    // cy.task should return the ID of the created alert
    const alertPayload = {
      stripe_account_id: testStripeAccountId,
      type: 'test.realtime.alert',
      severity: 'critical',
      description: 'E2E Realtime Test Alert',
      // other necessary fields...
    };
    cy.task('seedAlert', alertPayload, { timeout: 15000 }).then((result) => {
      // Type assertion if task returns typed result
      seededAlertId = (result as { id: string }).id;
      expect(seededAlertId).to.be.a('string');

      // 2. Assert badge increments (wait for realtime)
      cy.log('Waiting for alert badge...');
      cy.get('[aria-label*="View alerts"] span', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', '1');

      // 3. Assert toast appears (basic check - adjust selector as needed)
      cy.log('Checking for toast notification...');
      cy.contains('New Guardian Alert', { timeout: 5000 }).should('be.visible');
      cy.contains(alertPayload.type, { timeout: 1000 }).should('be.visible');

      // 4. Click bell icon link
      cy.log('Clicking alert bell icon...');
      cy.get('[aria-label*="View alerts"]').first().click(); // Target the link itself

      // 5. Assert navigation to alerts page
      cy.url().should('include', '/guardian/alerts');

      // 6. Assert badge disappears after clicking
      cy.log('Checking if alert badge disappeared...');
      cy.get('[aria-label*="View alerts"] span').should('not.exist');

      // 7. Verify alert_reads row exists in DB via task
      cy.log('Verifying alert read status in database...');
      cy.task(
        'checkAlertRead',
        { userId: testUserId, alertId: seededAlertId },
        { timeout: 10000 },
      ).should('equal', true); // Task should return true if read record exists
    });
  });

  // Add more tests if needed:
  // - Test counter incrementing beyond 1
  // - Test counter capping at 9+
  // - Test clicking toast link vs bell icon
});
