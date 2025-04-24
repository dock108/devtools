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
  payoutId: string | null;
  balanceCents: number;
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

    // Initialize balance if not present
    if (balances[acct] === undefined) {
      balances[acct] = 0;
    }

    // 3. Generate and create a random charge
    const amountCents = randomInt(5, 50 + 1) * 100; // $5.00 - $50.00
    let chargeId: string = 'ch_failed'; // Default in case of failure

    try {
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
      chargeId = charge.id;
      console.log(`[seed] charge ${acct} $${(amountCents / 100).toFixed(2)} → ${chargeId}`);

      // Update in-memory balance ONLY after successful charge
      balances[acct] = (balances[acct] ?? 0) + amountCents;
      console.log(`[seed] Balance after charge for ${acct}: $${(balances[acct] / 100).toFixed(2)}`);
    } catch (chargeError) {
      console.error(`[seed] Failed to create charge for ${acct}:`, chargeError);
      // Don't update balance if charge fails
    }

    // 4. Decide and create payout (60% chance if balance >= $3)
    const currentBalance = balances[acct] ?? 0;
    const shouldPayout = currentBalance >= 300 && Math.random() < 0.6;
    let payoutId: string | null = null;

    if (shouldPayout) {
      // Ensure payout amount is at least $3 and no more than the current balance
      const maxPayout = currentBalance;
      const minPayout = 300;
      const payoutCents = randomInt(minPayout, maxPayout + 1);

      console.log(`[seed] Attempting payout for ${acct}: $${(payoutCents / 100).toFixed(2)}...`);
      try {
        const payout = await stripe.payouts.create(
          {
            amount: payoutCents,
            currency: 'usd',
            description: 'Time-Warp payout',
          },
          { stripeAccount: acct },
        );
        payoutId = payout.id;
        balances[acct] -= payoutCents; // Update balance after successful payout
        console.log(
          `[seed] payout ${acct} $${(payoutCents / 100).toFixed(2)} → ${payoutId} ` +
            `| new balance $${(balances[acct] / 100).toFixed(2)}`,
        );
      } catch (payoutError) {
        console.error(`[seed] Failed to create payout for ${acct}:`, payoutError);
        // Balance remains unchanged if payout fails
      }
    } else {
      console.log(
        `[seed] No payout for ${acct}. Balance: $${(currentBalance / 100).toFixed(2)}, Roll < 0.6: ${Math.random() < 0.6}`,
      );
    }

    // TODO: Implement scenario logic here later

    // 5. Return result
    return { acct, chargeId, payoutId, balanceCents: balances[acct] ?? 0 };
  } catch (error) {
    console.error('[seed] Unhandled error during seed cycle:', error);
    throw error; // Re-throw the error to be caught by the API handler
  }
}
