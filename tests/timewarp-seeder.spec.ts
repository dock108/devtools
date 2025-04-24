import nock from 'nock';
import { runSeeder } from '../src/lib/timewarp-seeder';

// Clean up nock and reset env vars after each test
afterEach(() => {
  nock.cleanAll();
  delete process.env.GUARDIAN_ALPHA_SEED;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ACCOUNTS;
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
  expect(result).toHaveProperty('amountCents');
  expect(result?.amountCents).toBeGreaterThanOrEqual(500);
  expect(result?.amountCents).toBeLessThanOrEqual(5000);
});
