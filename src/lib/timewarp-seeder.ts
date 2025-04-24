import Stripe from 'stripe';
import { randomInt } from 'node:crypto';

// In-memory balance tracking (conceptual)
const balances: Record<string, number> = {};

/**
 * Time-Warp Seeder
 * Simulates one week of Stripe activity in one real-time hour.
 */
export async function runSeeder(): Promise<{
  acct: string;
  chargeId: string;
  amountCents: number;
} | void> {
  console.log('[seed] Starting time-warp seed cycle...');

  // 1. Load and validate environment variables
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const accountsRaw = process.env.ACCOUNTS;
  const speedFactor = Number(process.env.SPEED_FACTOR ?? 168); // 1 h → 1 wk

  if (!stripeKey) {
    console.error('[seed] STRIPE_SECRET_KEY environment variable is missing.');
    throw new Error('STRIPE_SECRET_KEY environment variable is missing');
  }
  if (!accountsRaw) {
    console.error('[seed] ACCOUNTS environment variable is missing.');
    throw new Error('ACCOUNTS environment variable is missing');
  }

  const accounts = accountsRaw
    .split(',')
    .map((acc) => acc.trim())
    .filter(Boolean);
  if (accounts.length === 0) {
    console.error('[seed] ACCOUNTS environment variable contains no valid account IDs.');
    throw new Error('ACCOUNTS environment variable contains no valid account IDs');
  }

  // Check safety flag AFTER validating required env vars
  if (process.env.GUARDIAN_ALPHA_SEED !== '1') {
    console.log('[seed] GUARDIAN_ALPHA_SEED not set to "1". Aborting.');
    return; // Return void if safety flag not set
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' });

  try {
    // 2. Select a random account
    const acct = accounts[randomInt(0, accounts.length)]; // randomInt is exclusive of max
    console.log(`[seed] Selected account: ${acct}`);

    // 3. Generate and create a random charge
    const amountCents = randomInt(5, 50 + 1) * 100; // $5.00 - $50.00

    console.log(`[seed] Creating charge for ${acct}: $${(amountCents / 100).toFixed(2)}...`);
    const charge = await stripe.charges.create(
      {
        amount: amountCents,
        currency: 'usd',
        source: 'tok_visa', // Standard test token
        description: `Time-Warp charge (${speedFactor}×)`,
        // Ensure transfer_data destination is set to correctly route funds
        transfer_data: {
          destination: acct,
        },
      },
      // Pass the stripeAccount option for Connect platform charges
      // This seems redundant if transfer_data is set, but included for clarity/safety
      // based on typical platform charge patterns. Review if it causes issues.
      // { stripeAccount: acct } // Might not be needed if transfer_data is used
    );
    console.log(`[seed] charge ${acct} $${(amountCents / 100).toFixed(2)} → ${charge.id}`);

    // 4. Update in-memory balance
    balances[acct] = (balances[acct] ?? 0) + amountCents;
    console.log(`[seed] Updated balance for ${acct}: $${(balances[acct] / 100).toFixed(2)}`);

    // TODO: Implement payout and scenario logic here later

    // 5. Return result
    return { acct, chargeId: charge.id, amountCents };
  } catch (error) {
    console.error('[seed] Unhandled error during seed cycle:', error);
    throw error; // Re-throw the error to be caught by the API handler
  }
}
