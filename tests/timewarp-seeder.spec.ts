import nock from 'nock';
import { runSeeder } from '../src/lib/timewarp-seeder';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

// Mock child_process module
// Mock fs module
const mockReadFileFn = jest.fn();
jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'), // Restore keeping other functions
  execFileSync: jest.fn(() => Buffer.from('ok')), // Mock implementation
}));
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  readFileSync: jest.fn(), // Define the mock function inside the factory
}));

// Store original Math.random
const originalMathRandom = Math.random;

// Reset all mocks before each test to ensure clean state
beforeEach(() => {
  // Minimal env for the helper
  process.env.STRIPE_SECRET_KEY = 'sk_test_smoke123'; // Use a distinct key
  process.env.ACCOUNTS = 'acct_test_smoke';
  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.SPEED_FACTOR = '168';

  // Clear mocks before each test
  (execFileSync as jest.Mock).mockClear();
  nock.cleanAll();
});

// Clean up nock and reset env vars after each test
afterEach(() => {
  nock.cleanAll();
  // Clean up environment variables
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ACCOUNTS;
  delete process.env.GUARDIAN_ALPHA_SEED;
  delete process.env.SPEED_FACTOR;
  jest.restoreAllMocks(); // Restore mocks including fs and Math.random
  // Clear module mocks
  (fs.readFileSync as jest.Mock).mockClear();
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
  // Mock Math.random specifically for this test
  const mockMathRandom = jest.spyOn(global.Math, 'random').mockReturnValue(0.1); // Ensure roll < 0.6

  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_payout';
  process.env.ACCOUNTS = 'acct_payout_test';

  // Mock charge (needs to add > 300 balance) and payout
  const scope = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_payout_charge', amount: 5000 }) // $50 charge
    .post('/v1/payouts') // Mock payout
    .reply(200, { id: 'po_payout_test' });

  const result = await runSeeder();

  // Assertions
  expect(scope.isDone()).toBe(true); // Ensure both mocks were called
  expect(result).toBeDefined();
  expect(result?.payoutId).toBe('po_payout_test'); // Verify payout ID
  expect(result?.balanceCents).toBeLessThan(5000); // Balance should decrease

  mockMathRandom.mockRestore(); // Restore Math.random after this test
});

it('does not create payout when balance low or roll fails', async () => {
  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_nopayout';

  // --- Test low balance case ---
  process.env.ACCOUNTS = 'acct_low_balance_only'; // Use a unique account ID
  // No need to mock Math.random here, balance is the deciding factor
  const chargeMockLowBalance = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_nopayout_charge_low', amount: 100 }); // Charge less than $3
  // Define the payout mock. We expect this NOT to be called.
  const payoutMockLowBalance = nock('https://api.stripe.com').post('/v1/payouts').reply(500);

  await runSeeder();
  expect(chargeMockLowBalance.isDone()).toBe(true);
  expect(nock.activeMocks()).toContain('POST https://api.stripe.com:443/v1/payouts');
  expect((await runSeeder())?.payoutId).toBeNull(); // Re-run to check payoutId
  nock.cleanAll(); // Clean specifically before next sub-test

  // --- Test roll fail case ---
  process.env.ACCOUNTS = 'acct_roll_fail_only'; // Use another unique account ID
  const mockMathRandomRollFail = jest.spyOn(global.Math, 'random').mockReturnValue(0.9); // Force roll > 0.6

  const chargeMockRollFail = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_nopayout_charge_roll', amount: 5000 }); // Sufficient balance
  // Define the payout mock again.
  const payoutMockRollFail = nock('https://api.stripe.com').post('/v1/payouts').reply(500);

  await runSeeder();
  expect(chargeMockRollFail.isDone()).toBe(true);
  expect(nock.activeMocks()).toContain('POST https://api.stripe.com:443/v1/payouts');
  expect((await runSeeder())?.payoutId).toBeNull(); // Re-run to check payoutId

  mockMathRandomRollFail.mockRestore(); // Restore Math.random
});

it('injects fraud scenario via stripe fixtures when roll succeeds', async () => {
  // Mock Math.random to ensure scenario injection
  const mockMathRandomInject = jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
  // Setup mock return value for readFileSync for this test
  (fs.readFileSync as jest.Mock).mockReturnValue(
    JSON.stringify([{ event: 'test', delayMs: 10000 }]),
  );

  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_inject';
  process.env.ACCOUNTS = 'acct_inject_test';
  process.env.SPEED_FACTOR = '10'; // For predictable scaling

  // Mock charge (doesn't matter much for this test)
  const chargeMock = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_inject_charge', amount: 500 });

  await runSeeder();

  // Access the mock via the imported module
  const mockExec = execFileSync as jest.Mock;
  expect(chargeMock.isDone()).toBe(true); // Basic check
  expect(fs.readFileSync).toHaveBeenCalledWith(
    expect.stringContaining('fixtures/scenarios/'),
    'utf8',
  );
  expect(mockExec).toHaveBeenCalledTimes(1);
  expect(mockExec).toHaveBeenCalledWith(
    'stripe',
    ['fixtures', '-', '--account', 'acct_inject_test', '--quiet'],
    expect.objectContaining({
      input: JSON.stringify([{ event: 'test', delayMs: 1000 }]), // 10000 / 10
      stdio: ['pipe', 'inherit', 'inherit'],
    }),
  );
  mockMathRandomInject.mockRestore(); // Restore Math.random
});

it('does NOT inject fraud scenario when roll fails', async () => {
  // Mock Math.random to ensure scenario injection is skipped
  const mockMathRandomNoInject = jest.spyOn(global.Math, 'random').mockReturnValue(0.9); // Ensures injectFraud is false (0.9 > 0.4)

  process.env.GUARDIAN_ALPHA_SEED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_no_inject';
  process.env.ACCOUNTS = 'acct_no_inject_test';

  // Mock charge
  const chargeMock = nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_no_inject_charge', amount: 500 });

  await runSeeder();

  // Access the mock via the imported module
  const mockExec = execFileSync as jest.Mock;
  expect(chargeMock.isDone()).toBe(true);
  expect(mockExec).not.toHaveBeenCalled();
  mockMathRandomNoInject.mockRestore(); // Restore Math.random
});

it('creates at least one charge without throwing', async () => {
  // Mock Stripe balance endpoint (needed for top-up check)
  nock('https://api.stripe.com')
    .get('/v1/balance')
    .reply(200, { available: [{ amount: 5000, currency: 'usd' }] }); // Assume $50 initial balance

  // Mock Stripe charge endpoint (must be called)
  const chargeScope = nock('https://api.stripe.com')
    .post('/v1/charges') // Use exact path or regex if needed
    .reply(200, { id: 'ch_smoke_123' });

  // Mock payout endpoint (may or may not be called, make it persist)
  nock('https://api.stripe.com')
    .persist() // Keep this mock active even if not hit initially
    .post('/v1/payouts') // Use exact path or regex
    .reply(200, { id: 'po_smoke_123' });

  await expect(runSeeder()).resolves.toBeDefined(); // Check it resolves, not just lack of throw

  // Assert charge call happened
  expect(chargeScope.isDone()).toBe(true);

  // Optional: Check if execFileSync was called (if scenario injection happened)
  // This depends on Math.random, so it's less reliable for a simple smoke test
  // console.log('execFileSync calls:', (execFileSync as jest.Mock).mock.calls.length);
});
