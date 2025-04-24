import nock from 'nock';
import { runSeeder } from '../src/lib/timewarp-seeder';

// Store original Math.random
const originalMathRandom = Math.random;

// Clean up nock and reset env vars and Math.random after each test
afterEach(() => {
  nock.cleanAll();
  delete process.env.GUARDIAN_ALPHA_SEED;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ACCOUNTS;
  Math.random = originalMathRandom; // Restore original Math.random
});

it('should run without throwing if safety flag is off', async () => {
  // Set required vars even if safety flag is off, as validation happens first
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.ACCOUNTS = 'acct_dummy';
  delete process.env.GUARDIAN_ALPHA_SEED; // Ensure safety flag is not set

  await expect(runSeeder()).resolves.toBeUndefined();
});

it('should throw if required env vars are missing', async () => {
  process.env.GUARDIAN_ALPHA_SEED = '1';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ACCOUNTS;
  await expect(runSeeder()).rejects.toThrow('STRIPE_SECRET_KEY environment variable is missing');

  // Test missing ACCOUNTS
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  delete process.env.ACCOUNTS;
  await expect(runSeeder()).rejects.toThrow('ACCOUNTS environment variable is missing');
});

it('creates one charge successfully', async () => {
  // Set required env vars
  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.ACCOUNTS = 'acct_123,acct_456';

  // Mock the Stripe API call
  const scope = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_test_success', amount: 1000 }); // Example response

  const result = await runSeeder();

  // Assertions
  expect(scope.isDone()).toBe(true); // Ensure the mock was called
  expect(result).toBeDefined();
  expect(result).toHaveProperty('chargeId', 'ch_test_success');
  expect(result).toHaveProperty('acct');
  expect(['acct_123', 'acct_456']).toContain(result?.acct);
  expect(result).toHaveProperty('balanceCents'); // Check for balanceCents
  // We can't assert the exact balance easily due to randomness,
  // but we know it should include the charge amount
  expect(result?.balanceCents).toBeGreaterThanOrEqual(1000);
});

it('creates payout when balance high', async () => {
  // Force random roll to trigger payout
  Math.random = () => 0.1; // Ensure roll < 0.6

  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_payout';
  process.env.ACCOUNTS = 'acct_payout_test';

  // Mock charge (needs to add > 300 balance) and payout
  const scope = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_payout_charge', amount: 5000 }) // $50 charge
    .post('/v1/payouts')
    .reply(200, { id: 'po_payout_test' });

  const result = await runSeeder();

  // Assertions
  expect(scope.isDone()).toBe(true); // Ensure both mocks were called
  expect(result).toBeDefined();
  expect(result?.payoutId).toBe('po_payout_test'); // Verify payout ID
  expect(result?.balanceCents).toBeLessThan(5000); // Balance should decrease
});

it('does not create payout when balance low or roll fails', async () => {
  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_nopayout';

  // --- Test low balance case ---
  process.env.ACCOUNTS = 'acct_low_balance_only'; // Use a unique account ID

  const chargeMockLowBalance = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_nopayout_charge_low', amount: 100 }); // Charge less than $3
  // Define the payout mock. We expect this NOT to be called.
  const payoutMockLowBalance = nock('https://api.stripe.com').post('/v1/payouts').reply(500);

  const resultLowBalance = await runSeeder();
  expect(chargeMockLowBalance.isDone()).toBe(true);
  // Check if the payout mock string is still in the active mocks list
  expect(nock.activeMocks()).toContain('POST https://api.stripe.com:443/v1/payouts');
  expect(resultLowBalance?.payoutId).toBeNull();

  // Clean mocks specifically for the next part of the test
  nock.cleanAll();

  // --- Test roll fail case ---
  process.env.ACCOUNTS = 'acct_roll_fail_only'; // Use another unique account ID
  Math.random = () => 0.9; // Force roll > 0.6

  const chargeMockRollFail = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_nopayout_charge_roll', amount: 5000 }); // Sufficient balance
  // Define the payout mock again.
  const payoutMockRollFail = nock('https://api.stripe.com').post('/v1/payouts').reply(500);

  const resultRollFail = await runSeeder();
  expect(chargeMockRollFail.isDone()).toBe(true);
  // Check if the payout mock string is still active
  expect(nock.activeMocks()).toContain('POST https://api.stripe.com:443/v1/payouts');
  expect(resultRollFail?.payoutId).toBeNull();

  Math.random = originalMathRandom; // Restore original Math.random
});
