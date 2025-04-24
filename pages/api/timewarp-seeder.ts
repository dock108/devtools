import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { randomInt } from 'crypto';
import * as path from 'path';
import { runSeeder } from '../../src/lib/timewarp-seeder';

// Helper function to get random integer
function getRandomInt(min: number, max: number): number {
  return randomInt(min, max + 1); // randomInt is exclusive of max
}

// Main seeder function - kept for now, but will be removed
// once the import is used in the handler
async function embeddedRunSeeder() {
  console.log('[INFO] Starting time-warp seed cycle...');

  // 1. Check safety flag
  if (process.env.GUARDIAN_ALPHA_SEED !== '1') {
    console.log('[WARN] GUARDIAN_ALPHA_SEED is not set to "1". Exiting.');
    return;
  }

  // 2. Validate required environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[ERROR] STRIPE_SECRET_KEY environment variable is missing.');
    throw new Error('STRIPE_SECRET_KEY environment variable is missing');
  }

  const ACCOUNTS_RAW = process.env.ACCOUNTS;
  if (!ACCOUNTS_RAW) {
    console.error('[ERROR] ACCOUNTS environment variable is missing.');
    throw new Error('ACCOUNTS environment variable is missing');
  }

  const ACCOUNTS = ACCOUNTS_RAW.split(',')
    .map((acc) => acc.trim())
    .filter(Boolean);

  if (ACCOUNTS.length === 0) {
    console.error('[ERROR] ACCOUNTS environment variable contains no valid account IDs.');
    throw new Error('ACCOUNTS environment variable contains no valid account IDs');
  }

  const SPEED_FACTOR = Number(process.env.SPEED_FACTOR ?? 168);

  // Initialize Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  // Determine base path for scenarios
  const BASE_DIR = process.cwd();
  const SCENARIOS_DIR = path.join(BASE_DIR, 'fixtures/scenarios');

  // Define scenario paths
  const SCENARIOS = [
    path.join(SCENARIOS_DIR, 'velocity-breach.json'),
    path.join(SCENARIOS_DIR, 'bank-swap.json'),
    path.join(SCENARIOS_DIR, 'geo-mismatch.json'),
  ];

  try {
    // 3. Choose random account
    const acct = ACCOUNTS[getRandomInt(0, ACCOUNTS.length - 1)];
    console.log(`[INFO] Selected account for cycle: ${acct}`);

    let currentBalance = 0; // We'll fetch the real balance

    // Fetch initial balance
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      // Assuming we primarily care about USD available balance
      const usdBalance = balance.available.find((b) => b.currency === 'usd');
      currentBalance = usdBalance?.amount || 0;
      console.log(`[INFO] Fetched initial balance for ${acct}: $${currentBalance / 100}`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch initial balance for account ${acct}:`, error);
      // Decide if we should continue or exit. For now, let's try to proceed cautiously.
      currentBalance = 0; // Assume 0 if fetch fails
    }

    // Add initial funding if balance is low (below $100)
    if (currentBalance < 10000) {
      const initialFundingAmount = 20000; // $200 - enough for future payouts
      try {
        await stripe.charges.create({
          amount: initialFundingAmount,
          currency: 'usd',
          source: 'tok_visa', // Standard test token
          transfer_data: {
            destination: acct,
          },
        });
        console.log(`[INFO] Added initial funding to ${acct}: $${initialFundingAmount / 100}`);

        // Wait 2 seconds for the funding to process
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Refetch balance after funding
        const updatedBalance = await stripe.balance.retrieve({ stripeAccount: acct });
        const updatedUsdBalance = updatedBalance.available.find((b) => b.currency === 'usd');
        currentBalance = updatedUsdBalance?.amount || 0;
        console.log(`[INFO] Updated balance after funding for ${acct}: $${currentBalance / 100}`);
      } catch (error) {
        console.error(`[ERROR] Failed to add initial funding to ${acct}:`, error);
        // Continue with what we have
      }
    }

    // 4. Create Charge
    const chargeAmt = getRandomInt(500, 5000); // $5.00 - $50.00 in cents
    let payoutAmt = undefined;

    try {
      await stripe.charges.create({
        amount: chargeAmt,
        currency: 'usd',
        source: 'tok_visa', // Standard test token
        transfer_data: {
          destination: acct,
        },
      });
      console.log(`[INFO] Created charge for ${acct}: $${chargeAmt / 100}`);
      currentBalance += chargeAmt; // Conceptually update balance
    } catch (error) {
      console.error(`[ERROR] Failed to create charge for ${acct}:`, error);
      // If charge fails, maybe skip payout/scenario?
      // Continue for now, balance fetch later will give ground truth.
    }

    // 5. Decide Payout or Scenario Injection
    const actionRoll = Math.random();

    if (actionRoll < 0.6 && currentBalance > 0) {
      // 60% chance: Payout
      const maxPayout = currentBalance; // Can payout up to the conceptual balance
      payoutAmt = getRandomInt(1, maxPayout); // Payout at least 1 cent

      try {
        await stripe.payouts.create(
          {
            amount: payoutAmt,
            currency: 'usd',
          },
          { stripeAccount: acct },
        );
        console.log(`[INFO] Created payout for ${acct}: $${payoutAmt / 100}`);
      } catch (error) {
        console.error(`[ERROR] Failed to create payout for ${acct}:`, error);
        payoutAmt = undefined; // Reset payoutAmt if it failed
      }
    } else if (actionRoll >= 0.6) {
      // 40% chance: Inject Scenario
      try {
        if (SCENARIOS.length > 0) {
          const randomFixture = SCENARIOS[getRandomInt(0, SCENARIOS.length - 1)];
          console.log(`[INFO] Selected fixture for injection: ${path.basename(randomFixture)}`);

          // Read and process the scenario
          const content = readFileSync(randomFixture, 'utf-8');
          const events = JSON.parse(content).map((event: any) => ({
            ...event,
            delayMs: Math.max(200, Math.floor(event.delayMs / SPEED_FACTOR)),
          }));

          console.log(`[INFO] Processing ${events.length} events from scenario`);

          // Process each event in sequence
          for (let i = 0; i < events.length; i++) {
            const event = events[i];

            // Apply speed factor to delay
            const adjustedDelay = Math.max(200, Math.floor(event.delayMs / SPEED_FACTOR));

            // Wait for the delay
            if (adjustedDelay > 0) {
              await new Promise((resolve) => setTimeout(resolve, adjustedDelay));
            }

            console.log(`[INFO] Processing event ${i + 1}/${events.length}: ${event.type}`);

            // For now, we're just logging the events
            // In a future implementation, you could use stripe.testHelpers.createTestClock()
            // and related methods to actually trigger these events in Stripe
          }

          console.log(`[INFO] Scenario processing complete: ${path.basename(randomFixture)}`);
        } else {
          console.warn('[WARN] No scenario fixtures found for injection');
        }
      } catch (error) {
        console.error('[ERROR] Failed to read or process scenario fixtures:', error);
      }
    }

    // 7. Log final balance
    let finalBalance = 0;
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      const usdBalance = balance.available.find((b) => b.currency === 'usd');
      finalBalance = usdBalance?.amount || 0;
      console.log(`[INFO] Final balance for ${acct}: $${finalBalance / 100}`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch final balance for account ${acct}:`, error);
      finalBalance = -1; // Indicate fetch failure
    }

    console.log(
      `[INFO] Time-warp tick complete for ${acct}: charge=$${chargeAmt / 100}${
        payoutAmt !== undefined ? `, payout=$${payoutAmt / 100}` : ''
      }, balance=${finalBalance === -1 ? 'Fetch Error' : `$${finalBalance / 100}`}`,
    );

    return {
      account: acct,
      charge: chargeAmt / 100,
      payout: payoutAmt !== undefined ? payoutAmt / 100 : undefined,
      balance: finalBalance === -1 ? 'Fetch Error' : finalBalance / 100,
    };
  } catch (error) {
    console.error('[ERROR] Unhandled error during seed cycle:', error);
    throw error;
  }
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Starting timewarp-seeder API handler...');

    // Call the imported runSeeder function
    const result = await runSeeder();

    // Check if runSeeder returned void (e.g., safety flag not set)
    if (!result) {
      console.log('runSeeder returned void (likely due to safety flag). Handler exiting.');
      return res.status(200).json({
        ok: true,
        message: 'Seeder run aborted (safety flag or other condition).',
      });
    }

    // If runSeeder completed successfully
    console.log('runSeeder completed. Sending success response.', result);
    return res.status(200).json({
      ok: true,
      message: 'Seeder ran successfully.',
      data: result,
    });
  } catch (error) {
    console.error('Seeder API handler failed:', error);
    // Log the stack trace if available
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`Error message: ${errorMessage}`);
    if (stack) console.error(`Stack trace: ${stack}`);

    return res.status(500).json({
      ok: false,
      error: 'Seeder API failed',
      message: errorMessage,
      stack: stack, // Optionally include stack in dev environments
    });
  }
}
