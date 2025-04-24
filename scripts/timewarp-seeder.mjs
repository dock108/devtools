#!/usr/bin/env node
import Stripe from 'stripe';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple inline logger - no external dependencies
const logger = {
  info: (msgOrObj, msgOptional) => {
    if (msgOptional) {
      console.log(`[INFO] ${msgOptional}:`, msgOrObj);
    } else {
      console.log(`[INFO] ${msgOrObj}`);
    }
  },
  warn: (msgOrObj, msgOptional) => {
    if (msgOptional) {
      console.warn(`[WARN] ${msgOptional}:`, msgOrObj);
    } else {
      console.warn(`[WARN] ${msgOrObj}`);
    }
  },
  error: (msgOrObj, msgOptional) => {
    if (msgOptional) {
      console.error(`[ERROR] ${msgOptional}:`, msgOrObj);
    } else {
      console.error(`[ERROR] ${msgOrObj}`);
    }
  },
};

// --- Configuration & Environment Variables ---

const GUARDIAN_ALPHA_SEED = process.env.GUARDIAN_ALPHA_SEED;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ACCOUNTS_RAW = process.env.ACCOUNTS;
const SPEED_FACTOR = parseInt(process.env.SPEED_FACTOR || '168', 10);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/scenarios');

// --- Helper Functions ---

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Scenario Processing ---

async function processScenario(acct, stripe, scenarioPath) {
  try {
    // Read and parse the scenario file
    const content = await readFile(scenarioPath, 'utf-8');
    const events = JSON.parse(content);

    if (!Array.isArray(events) || events.length === 0) {
      logger.warn({ acct, scenarioPath }, 'Scenario file has invalid format or is empty');
      return;
    }

    logger.info(
      { acct, scenarioFile: path.basename(scenarioPath), eventCount: events.length },
      'Processing scenario events',
    );

    // Process each event in sequence
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Apply speed factor to delay
      const adjustedDelay = Math.max(0, Math.floor(event.delayMs / SPEED_FACTOR));

      // Only wait if not the first event
      if (adjustedDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, adjustedDelay));
      }

      // Log the event we're processing
      logger.info(
        {
          acct,
          eventType: event.type,
          eventIndex: i + 1,
          totalEvents: events.length,
          originalDelay: event.delayMs,
          adjustedDelay,
        },
        'Processing scenario event',
      );

      // Process the event based on its type
      switch (event.type) {
        case 'account.updated':
          // For account updates, we might not need to do anything, just log it
          logger.info(
            {
              acct,
              accountId: event.payload?.id,
              updatedFields: Object.keys(event.payload || {}),
            },
            'Account update event',
          );
          break;

        case 'charge.succeeded':
          // For charges, we could log details
          logger.info(
            {
              acct,
              chargeId: event.payload?.id,
              amount: event.payload?.amount / 100,
              currency: event.payload?.currency,
            },
            'Charge succeeded event',
          );
          break;

        case 'payout.created':
        case 'payout.updated':
        case 'payout.paid':
          // Log payout events
          logger.info(
            {
              acct,
              payoutId: event.payload?.id,
              amount: event.payload?.amount / 100,
              status: event.payload?.status,
              flagged: event.payload?.flagged,
            },
            `Payout ${event.type.split('.')[1]} event`,
          );

          // If we're processing a Guardian-paused payout, log it specially
          if (event.payload?.metadata?.guardian_action === 'paused') {
            logger.info(
              {
                acct,
                payoutId: event.payload?.id,
                reason: event.payload?.metadata?.guardian_reason,
                riskFactors: event.payload?.metadata?.risk_factors,
              },
              'Guardian action triggered',
            );
          }
          break;

        case 'external_account.created':
          logger.info(
            {
              acct,
              bankAccountId: event.payload?.id,
              bankName: event.payload?.bank_name,
              country: event.payload?.country,
              last4: event.payload?.last4,
            },
            'New bank account created',
          );
          break;

        case 'account.external_account.default_for_currency.updated':
          logger.info(
            {
              acct,
              accountId: event.payload?.id,
              defaultAccount: event.payload?.default_for_currency,
            },
            'Default bank account updated',
          );
          break;

        default:
          logger.info({ acct, eventType: event.type }, 'Unhandled event type');
      }
    }

    logger.info(
      { acct, scenarioFile: path.basename(scenarioPath) },
      'Scenario processing complete',
    );
  } catch (error) {
    logger.error({ acct, scenarioPath, error }, 'Failed to process scenario');
  }
}

// --- Main Seeder Logic ---

async function runSeedCycle() {
  logger.info('Starting time-warp seed cycle...');

  // 1. Check safety flag
  if (GUARDIAN_ALPHA_SEED !== '1') {
    logger.warn('GUARDIAN_ALPHA_SEED is not set to "1". Exiting.');
    process.exit(0);
  }

  // 2. Validate required environment variables
  if (!STRIPE_SECRET_KEY) {
    logger.error('STRIPE_SECRET_KEY environment variable is missing.');
    process.exit(1);
  }
  if (!ACCOUNTS_RAW) {
    logger.error('ACCOUNTS environment variable is missing.');
    process.exit(1);
  }

  const ACCOUNTS = ACCOUNTS_RAW.split(',')
    .map((acc) => acc.trim())
    .filter(Boolean);
  if (ACCOUNTS.length === 0) {
    logger.error('ACCOUNTS environment variable contains no valid account IDs.');
    process.exit(1);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  try {
    // 3. Choose random account
    const acct = ACCOUNTS[getRandomInt(0, ACCOUNTS.length - 1)];
    logger.info({ acct }, 'Selected account for cycle');

    let currentBalance = 0; // We'll fetch the real balance

    // Fetch initial balance
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      // Assuming we primarily care about USD available balance
      const usdBalance = balance.available.find((b) => b.currency === 'usd');
      currentBalance = usdBalance?.amount || 0;
      logger.info({ acct, balance: currentBalance / 100 }, 'Fetched initial balance');
    } catch (error) {
      logger.error({ acct, error }, 'Failed to fetch initial balance for account');
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
        logger.info({ acct, amount: initialFundingAmount / 100 }, 'Added initial funding');

        // Wait 2 seconds for the funding to process
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Refetch balance after funding
        const updatedBalance = await stripe.balance.retrieve({ stripeAccount: acct });
        const updatedUsdBalance = updatedBalance.available.find((b) => b.currency === 'usd');
        currentBalance = updatedUsdBalance?.amount || 0;
        logger.info({ acct, balance: currentBalance / 100 }, 'Updated balance after funding');
      } catch (error) {
        logger.error(
          { acct, amount: initialFundingAmount / 100, error },
          'Failed to add initial funding',
        );
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
      logger.info({ acct, amount: chargeAmt / 100 }, 'Created charge');
      currentBalance += chargeAmt; // Conceptually update balance
    } catch (error) {
      logger.error({ acct, amount: chargeAmt / 100, error }, 'Failed to create charge');
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
        logger.info({ acct, amount: payoutAmt / 100 }, 'Created payout');
        // currentBalance -= payoutAmt; // Conceptually update balance
      } catch (error) {
        logger.error({ acct, amount: payoutAmt / 100, error }, 'Failed to create payout');
        payoutAmt = undefined; // Reset payoutAmt if it failed
      }
    } else if (actionRoll >= 0.6) {
      // Using >= 0.6 for the remaining 40%
      // 40% chance: Inject Scenario
      try {
        const files = await readdir(FIXTURES_DIR);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));

        if (jsonFiles.length > 0) {
          const randomFixture = jsonFiles[getRandomInt(0, jsonFiles.length - 1)];
          const fixturePath = path.join(FIXTURES_DIR, randomFixture);

          logger.info(
            { acct, fixture: randomFixture, speedFactor: SPEED_FACTOR },
            'Selected fixture for injection',
          );

          // Now actually process the scenario
          await processScenario(acct, stripe, fixturePath);
        } else {
          logger.warn({ directory: FIXTURES_DIR }, 'No scenario fixtures found for injection');
        }
      } catch (error) {
        logger.error(
          { acct, directory: FIXTURES_DIR, error },
          'Failed to read or process scenario fixtures',
        );
      }
    }

    // 7. Log final balance
    let finalBalance = 0;
    try {
      const balance = await stripe.balance.retrieve({ stripeAccount: acct });
      const usdBalance = balance.available.find((b) => b.currency === 'usd');
      finalBalance = usdBalance?.amount || 0;
    } catch (error) {
      logger.error({ acct, error }, 'Failed to fetch final balance for account');
      // Use conceptual balance as fallback? Or log -1? Logging error is primary.
      finalBalance = -1; // Indicate fetch failure
    }

    logger.info(
      {
        acct,
        chargeAmt: chargeAmt / 100,
        ...(payoutAmt !== undefined && { payoutAmt: payoutAmt / 100 }), // Only include if payout happened
        balance: finalBalance === -1 ? 'Fetch Error' : finalBalance / 100,
      },
      'Time-warp tick complete',
    );
  } catch (error) {
    logger.error({ error }, 'Unhandled error during seed cycle');
    process.exit(1);
  }
}

// --- Script Execution ---

(async () => {
  await runSeedCycle();
  logger.info('Seed cycle finished.');
})();
