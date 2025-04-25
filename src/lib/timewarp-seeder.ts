import Stripe from 'stripe';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync, ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'; // Import type
import * as path from 'path'; // Import path if needed for scenario paths

// In-memory balance tracking (conceptual)
const balances: Record<string, number> = {};

// List of scenario files (use relative paths from project root)
const SCENARIOS = [
  'fixtures/scenarios/velocity-breach.json',
  'fixtures/scenarios/bank-swap.json',
  'fixtures/scenarios/geo-mismatch.json',
];

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

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  console.log('[seed] Stripe client initialized.');

  try {
    // 2. Select a random account
    console.log('[seed] Selecting account...');
    const acct = accounts[randomInt(0, accounts.length)];
    console.log(`[seed] Selected account: ${acct}`);

    // --- Check and Top-Up Balance ---
    console.log(`[seed] Checking initial balance for ${acct}...`);
    try {
      let balanceResponse = await stripe.balance.retrieve({ stripeAccount: acct });
      let usdBalance = balanceResponse.available.find((b) => b.currency === 'usd');
      let currentFetchedBalance = usdBalance?.amount ?? 0;
      console.log(
        `[seed] Current fetched balance for ${acct}: $${(currentFetchedBalance / 100).toFixed(2)}`,
      );

      // If balance is less than $100, add $10,000 top-up
      if (currentFetchedBalance < 10000) {
        const topUpAmount = 1000000; // $10,000
        console.log(
          `[seed] Balance low. Adding direct top-up of $${(topUpAmount / 100).toFixed(2)} to ${acct}...`,
        );
        await stripe.topups.create(
          {
            amount: topUpAmount,
            currency: 'usd',
            description: 'Sandbox Balance Top-Up [$10k]',
            source: 'tok_visa', // Use test token as the source for the top-up
          },
          {
            stripeAccount: acct, // Specify the connected account ID here
          },
        );
        console.log(`[seed] Direct top-up [$10k] created for ${acct}.`);

        // --- Add Delay and Re-fetch Balance ---
        console.log('[seed] Waiting 10 seconds for top-up to settle...');
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10-second delay

        console.log(`[seed] Re-fetching balance for ${acct} after top-up...`);
        balanceResponse = await stripe.balance.retrieve({ stripeAccount: acct });
        usdBalance = balanceResponse.available.find((b) => b.currency === 'usd');
        currentFetchedBalance = usdBalance?.amount ?? currentFetchedBalance; // Use new or old if fetch fails
        console.log(
          `[seed] Fetched balance after top-up for ${acct}: $${(currentFetchedBalance / 100).toFixed(2)}`,
        );
        // --- End Delay and Re-fetch ---
      } else {
        console.log(`[seed] Balance for ${acct} is sufficient.`);
      }
      // Update in-memory balance based on the LATEST fetched balance
      balances[acct] = currentFetchedBalance;
    } catch (balanceError: any) {
      console.error(`[seed] Failed during balance check/top-up for ${acct}:`, balanceError);
      // Check if it's a permission error specifically
      if (balanceError?.type === 'StripePermissionError') {
        console.warn(
          `[seed] PERMISSION ERROR accessing balance/topups for ${acct}. Skipping this account for the current cycle. Check OAuth scopes or account status.`,
        );
        // Throw a specific error to stop processing for this account in this run
        throw new Error(`Permission denied for account ${acct}. Skipping run.`);
      } else {
        // For other errors (network issues, etc.), log and attempt to proceed with 0 balance
        console.warn(
          `[seed] Non-permission error during balance check/top-up for ${acct} (${balanceError.message}). Proceeding with assumed 0 balance.`,
        );
        balances[acct] = 0;
      }
    }
    console.log(
      `[seed] In-memory balance for ${acct} set to: $${(balances[acct] / 100).toFixed(2)}`,
    );

    // Initialize balance if not present (safe check)
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

    // 4. Decide and create payout (Uses balance AFTER fetch/top-up + charge)
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

    // --- Inject Fraud Scenario ---
    console.log('[seed] Evaluating fraud scenario injection...');
    // const injectFraud = Math.random() < 0.4; // 40% chance
    const injectFraud = Math.random() < 0.9; // TEMP: 90% chance for testing
    let scenarioFile = 'N/A'; // Initialize scenarioFile

    if (injectFraud) {
      scenarioFile = SCENARIOS[randomInt(0, SCENARIOS.length)];
      console.log(`[seed] Attempting to inject scenario: ${scenarioFile} into ${acct}...`);
      let scaledEvents: any[] = []; // Define scaledEvents variable

      try {
        // Prepare scenario data
        console.log('[seed] Reading scenario file...');
        const scenarioContent = readFileSync(scenarioFile, 'utf8');
        console.log('[seed] Parsing scenario content...');
        const events = JSON.parse(scenarioContent);
        console.log('[seed] Scaling scenario events...');
        scaledEvents = events.map((e: any) => ({
          ...e,
          delayMs: Math.max(200, Math.floor(e.delayMs / speedFactor)),
        }));

        // Attempt injection via Stripe CLI
        console.log('[seed] Executing stripe fixtures command...');
        const execOptions: ExecFileSyncOptionsWithStringEncoding = {
          input: JSON.stringify(scaledEvents),
          encoding: 'utf8',
          stdio: 'pipe', // Capture stdout/stderr
          timeout: 30000, // Add a timeout (30 seconds)
        };

        // Wrap execFileSync in its own try/catch to handle non-zero exit
        try {
          execFileSync('stripe', ['fixtures', '-', '--account', acct, '--quiet'], execOptions);
          console.log(
            `[seed] Stripe CLI fixtures injected successfully for ${scenarioFile} into ${acct}`,
          );
        } catch (cliExecError: any) {
          // execFileSync throws on non-zero exit code
          // Extract status and stderr from the error object if they exist
          const status = cliExecError.status ?? 'unknown';
          const stderr = cliExecError.stderr?.toString().trim() || 'No stderr captured';
          console.error(`[seed] stripe fixtures CLI failed with status ${status}`);
          console.error(`[seed] stderr: ${stderr}`);
          // Re-throw a more informative error to trigger the outer catch block (fallback logic)
          throw new Error(`stripe fixtures failed (status ${status}): ${stderr}`);
        }
      } catch (scenarioProcessingError: any) {
        // This outer catch now handles errors from file reading, JSON parsing,
        // or the re-thrown error from execFileSync failure.
        console.warn(
          `[seed] Scenario processing/CLI failed for ${scenarioFile} (Account: ${acct}). Falling back to Test Helpers API. Error: ${scenarioProcessingError.message}`,
        );

        // Fallback using Stripe Test Helpers API
        if (scaledEvents.length > 0) {
          console.log(
            `[seed] Attempting fallback injection for ${scaledEvents.length} events via Test Helpers API...`,
          );
          try {
            console.log('[seed] Available Test Helpers:', Object.keys(stripe.testHelpers)); // Log available helpers
            for (const [index, e] of scaledEvents.entries()) {
              console.log(
                `[seed] Fallback: Processing event ${index + 1}/${scaledEvents.length} - Type: ${e.type}`,
              );
              if (e.delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, e.delayMs));
              }

              switch (e.type) {
                case 'payout.created':
                  if (e.data?.object?.amount && e.data?.object?.currency) {
                    // Explicitly cast testHelpers to any to bypass type check
                    await (stripe.testHelpers as any).payouts.create(
                      { amount: e.data.object.amount, currency: e.data.object.currency },
                      { stripeAccount: acct },
                    );
                    console.log(`[seed] Fallback: Simulated payout.created for ${acct}`);
                  } else {
                    console.warn(
                      `[seed] Fallback: Skipping payout.created due to missing data for ${acct}`,
                    );
                  }
                  break;
                // Add cases for other relevant event types from your scenarios
                // Example: External Account creation (requires Test Clock potentially)
                // case 'customer.created':
                //   await stripe.testHelpers.customers.create(...) break;
                // case 'charge.succeeded':
                //   await stripe.testHelpers.charges.create(...) break;
                default:
                  console.log(
                    `[seed] Fallback: No Test Helper implemented for event type: ${e.type}`,
                  );
              }
            }
            console.log(
              `[seed] Fallback injection via Test Helpers API completed for ${scenarioFile} into ${acct}.`,
            );
          } catch (helperError: any) {
            console.error(
              `[seed] Fallback Test Helpers API injection failed for ${scenarioFile} (Account: ${acct}):`,
              helperError,
            );
            // Decide if this error should be re-thrown or just logged
          }
        } else {
          console.warn(
            `[seed] Fallback skipped: No scaled events available after CLI failure for ${scenarioFile} (Account: ${acct}).`,
          );
        }
      }
    } else {
      console.log('[seed] Skipping fraud scenario injection (roll failed).');
    }

    // 5. Return result
    console.log('[seed] Preparing result...');
    return { acct, chargeId, payoutId, balanceCents: balances[acct] ?? 0 };
  } catch (error) {
    console.error('[seed] Unhandled error in runSeeder try block:', error);
    throw error;
  }
}
