# End-to-End Tests

This directory contains Playwright tests that verify our critical user flows and marketing pages are working correctly.

## Smoke Tests

The smoke test suite (`marketing.smoke.spec.ts`) verifies that our key marketing pages load correctly without 404 errors or JavaScript runtime exceptions. This is a lightweight test that runs as part of our CI/CD pipeline to catch issues before they reach production.

### Running the tests

To run the smoke tests locally:

```bash
# Run in headless mode
npm run test:e2e

# Run in headed mode for debugging
PWDEBUG=1 npm run test:e2e
```

### Test coverage

The smoke tests currently cover these routes:
- Homepage (`/`)
- Stripe Guardian product page (`/stripe-guardian`)
- Guardian Demo (`/guardian-demo`)

### Adding new routes

To add a new route to the smoke tests, simply add it to the `routes` array in `marketing.smoke.spec.ts`. 