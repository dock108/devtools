import Stripe from 'stripe';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFile, ExecFileOptionsWithStringEncoding } from 'node:child_process';
import * as path from 'path';
import { promisify } from 'util';

// Promisify execFile for async/await usage
const execFileAsync = promisify(execFile);

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
    const injectFraud = Math.random() < 0.9; // TEMP: 90% chance
    let scenarioFile = 'N/A';

    if (injectFraud) {
      scenarioFile = SCENARIOS[randomInt(0, SCENARIOS.length)];
      console.log(`[seed] Attempting to inject scenario: ${scenarioFile} into ${acct}...`);
      let scaledEvents: any[] = [];

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

        // Attempt injection via Stripe CLI using execFileAsync
        console.log('[seed] Executing stripe fixtures command via execFileAsync...');
        const cliPath = path.resolve('node_modules/.bin/stripe'); // Explicit path
        const cliArgs = ['fixtures', '-', '--account', acct, '--quiet'];
        const execOptions: ExecFileOptionsWithStringEncoding = {
          encoding: 'utf8',
          timeout: 30000, // 30 second timeout
          // uid / gid might be needed in some environments, but often not
        };

        // Use await with execFileAsync and pass input via stdin option later if possible,
        // or handle stdio streams manually if needed. For now, pass input via options.
        // NOTE: execFile doesn't directly support 'input' like execFileSync.
        // We need to pipe it manually or use a different approach if input is large.
        // Let's try a simple execution first and handle input piping if it fails.
        // For simplicity now, assuming the direct execFile without piping input might work
        // for stripe CLI or reveal path/permission errors.
        // A more robust solution would involve child.stdin.write() and child.stdin.end().

        console.log(`[seed] Attempting CLI command: ${cliPath} ${cliArgs.join(' ')}`);
        // We will execute and pipe input in the next step if this direct call fails
        // For now, just check if the command itself executes without error

        // TODO: Implement input piping for execFile
        console.warn(
          "[seed] Input piping for execFile not implemented yet. CLI injection won't work fully.",
        );
        // As a placeholder, let's simulate a CLI failure to test the fallback
        throw new Error('Simulating CLI failure due to missing input piping');

        // --- Code to use when input piping is implemented ---
        /* 
        const { stdout, stderr } = await execFileAsync(cliPath, cliArgs, execOptions);
        console.log(`[seed] Stripe CLI stdout: ${stdout}`);
        if (stderr) {
           console.error(`[seed] Stripe CLI stderr: ${stderr}`);
           // Check stderr for specific error messages if needed
           if (stderr.includes("You are not permitted")) {
              throw new Error(`Stripe CLI permission error: ${stderr.trim()}`);
           } else {
              throw new Error(`Stripe CLI execution failed: ${stderr.trim()}`);
           }
        }
        console.log(`[seed] Stripe CLI fixtures injected successfully for ${scenarioFile} into ${acct}`);
        */
        // --- End of future code ---
      } catch (scenarioProcessingError: any) {
        // Catch errors from file reading, JSON parsing, or CLI execution
        console.warn(
          `[seed] Scenario processing/CLI failed for ${scenarioFile} (Account: ${acct}). Error: ${scenarioProcessingError.message}`,
        );
        // Log the full error if helpful
        // console.error(scenarioProcessingError);

        // Fallback is removed as Test Helpers don't support payouts
        console.log('[seed] Fallback via Test Helpers skipped (payouts helper unavailable).');
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
