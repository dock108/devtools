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
  console.log('[seed] runSeeder invoked.');

  // 1. Load and validate environment variables
  console.log('[seed] Loading environment variables...');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const accountsRaw = process.env.ACCOUNTS;
  const speedFactor = Number(process.env.SPEED_FACTOR ?? 168);
  console.log(`[seed] SPEED_FACTOR: ${speedFactor}`);

  if (!stripeKey) {
    console.error('[seed] STRIPE_SECRET_KEY missing.');
    throw new Error('STRIPE_SECRET_KEY environment variable is missing');
  }
  if (!accountsRaw) {
    console.error('[seed] ACCOUNTS missing.');
    throw new Error('ACCOUNTS environment variable is missing');
  }
  console.log('[seed] Required env vars present.');

  const accounts = accountsRaw
    .split(',')
    .map((acc) => acc.trim())
    .filter(Boolean);
  if (accounts.length === 0) {
    console.error('[seed] No valid ACCOUNTS found.');
    throw new Error('ACCOUNTS environment variable contains no valid account IDs');
  }
  console.log(`[seed] Found accounts: ${accounts.join(', ')}`);

  // Check safety flag
  console.log('[seed] Checking safety flag...');
  if (process.env.GUARDIAN_ALPHA_SEED !== '1') {
    console.log('[seed] GUARDIAN_ALPHA_SEED not set to "1". Aborting.');
    return;
  }
  console.log('[seed] Safety flag OK.');

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' });
  console.log('[seed] Stripe client initialized.');

  try {
    // 2. Select a random account
    console.log('[seed] Selecting account...');
    const acct = accounts[randomInt(0, accounts.length)];
    console.log(`[seed] Selected account: ${acct}`);

    // --- Check and Top-Up Balance ---
    console.log(`[seed] Checking initial balance for ${acct}...`);
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      const usdBalance = balance.available.find((b) => b.currency === 'usd');
      let currentBalance = usdBalance?.amount ?? 0;
      console.log(
        `[seed] Current fetched balance for ${acct}: $${(currentBalance / 100).toFixed(2)}`,
      );

      // If balance is less than $100, add $10,000 top-up
      if (currentBalance < 10000) {
        const topUpAmount = 1000000; // $10,000 (1,000,000 cents)
        console.log(
          `[seed] Balance low. Adding $${(topUpAmount / 100).toFixed(2)} top-up to ${acct}...`,
        );
        await stripe.charges.create({
          amount: topUpAmount,
          currency: 'usd',
          source: 'tok_visa', // Standard test token
          description: 'Sandbox Top-Up [$10k]',
          transfer_data: {
            destination: acct,
          },
        });
        console.log(`[seed] Top-up [$10k] charge created for ${acct}.`);
        // Update balance variable AFTER top-up charge creation
        currentBalance += topUpAmount;
      } else {
        console.log(`[seed] Balance for ${acct} is sufficient.`);
      }
      // Update in-memory balance based on fetch + potential top-up
      balances[acct] = currentBalance;
    } catch (balanceError) {
      console.error(`[seed] Failed to fetch or top-up balance for ${acct}:`, balanceError);
      // Initialize balance to 0 in memory if fetch fails
      balances[acct] = 0;
    }
    console.log(
      `[seed] In-memory balance for ${acct} after check/top-up: $${(balances[acct] / 100).toFixed(2)}`,
    );

    // Initialize balance if not present (redundant after check, but safe)
    if (balances[acct] === undefined) {
      balances[acct] = 0;
    }

    // 3. Generate and create a random charge
    console.log('[seed] Preparing charge...');
    const amountCents = randomInt(5, 50 + 1) * 100; // $5.00 - $50.00
    let chargeId: string = 'ch_failed'; // Default in case of failure

    try {
      console.log(`[seed] Creating charge for ${acct}...`);
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
      console.log(`[seed] Charge successful: ${chargeId}`);

      // Update in-memory balance ONLY after successful charge
      balances[acct] = (balances[acct] ?? 0) + amountCents;
      console.log(`[seed] Balance after charge for ${acct}: $${(balances[acct] / 100).toFixed(2)}`);
    } catch (chargeError) {
      console.error(`[seed] Charge creation failed:`, chargeError);
      // Don't update balance if charge fails
    }

    // 4. Decide and create payout (uses updated balance)
    console.log('[seed] Evaluating payout...');
    const currentBalanceForPayout = balances[acct] ?? 0;
    const shouldPayout = currentBalanceForPayout >= 300 && Math.random() < 0.6;
    let payoutId: string | null = null;

    if (shouldPayout) {
      // Ensure payout amount is at least $3 and no more than the current balance
      const maxPayout = currentBalanceForPayout;
      const minPayout = 300;
      const payoutCents = randomInt(minPayout, maxPayout + 1);

      console.log(`[seed] Attempting payout for ${acct}...`);
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
        console.log(`[seed] Payout successful: ${payoutId}`);
      } catch (payoutError) {
        console.error(`[seed] Payout creation failed:`, payoutError);
        // Balance remains unchanged if payout fails
      }
    } else {
      console.log(`[seed] Skipping payout for ${acct}.`);
    }

    // TODO: Implement scenario logic here later

    // 5. Return result
    console.log('[seed] Preparing result...');
    return { acct, chargeId, payoutId, balanceCents: balances[acct] ?? 0 };
  } catch (error) {
    console.error('[seed] Unhandled error in runSeeder try block:', error);
    throw error;
  }
}
