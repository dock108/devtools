#!/usr/bin/env ts-node
import 'dotenv/config'; // Load .env.local automatically
import fs from 'fs/promises';
import { readFileSync } from 'fs'; // For synchronous YAML read
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml'; // Need to install js-yaml: npm install js-yaml @types/js-yaml --save-dev
import { createClient } from '@supabase/supabase-js'; // Need to install @supabase/supabase-js
import { waitForQueueDrained } from './lib/queue-helpers'; // Import the queue helper

// --- Configuration ---
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL || 'http://localhost:3000/api/stripe/webhook';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_TEST_WEBHOOK_SECRET; // Use test secret from .env.local
const FIXTURE_DIR = path.join(__dirname, '../test/fixtures/stripe');
const EXPECTED_ALERTS_PATH = path.join(FIXTURE_DIR, 'expected-alerts.yml');

// Supabase Client (assuming env vars are set in .env.local)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- Helper Functions ---

/**
 * Generates the Stripe-Signature header.
 * @param payload - The raw request body (string).
 * @param secret - The webhook signing secret.
 * @returns The Stripe-Signature header string.
 */
function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Sends a single event payload to the webhook endpoint.
 * @param payload - The event payload object.
 * @param signature - The Stripe-Signature header.
 */
async function sendEvent(payload: object, signature: string): Promise<void> {
  const rawPayload = JSON.stringify(payload);
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      body: rawPayload,
    });
    console.log(`Sent event ${payload['id'] || 'unknown'}. Status: ${response.status}`);
    if (!response.ok) {
      console.error(`  Error: ${await response.text()}`);
    }
  } catch (error) {
    console.error(`Failed to send event ${payload['id'] || 'unknown'}:`, error);
  }
}

/**
 * Calculates the expected *initial* risk score based on the baseline
 * weights defined in the `compute_risk_score_before` DB trigger function,
 * assuming zero false-positive history for the test run.
 *
 * @param alertType - The type of the alert (e.g., 'velocity', 'bank_swap').
 * @param accountId - The Stripe account ID (currently unused in this simplified version).
 * @returns The expected initial risk score (0-100).
 */
function calculateExpectedRiskScore(alertType: string, accountId: string): number {
  // Baseline weights from the compute_risk_score_before function
  let ruleWeight = 10; // Default weight for unknown types
  switch (alertType) {
    case 'velocity':
      ruleWeight = 30;
      break;
    case 'bank_swap':
      ruleWeight = 40;
      break;
    case 'geo_mismatch':
      ruleWeight = 25;
      break;
    case 'failed_charge_burst':
      ruleWeight = 35;
      break;
    case 'sudden_payout_disable':
      ruleWeight = 20;
      break;
    case 'high_risk_review':
      ruleWeight = 50;
      break;
  }

  // Simplified formula for initial score (assuming acct_rule_fp=0 and global_fp=0):
  // score = rule_weight * (1 - 0) * (1 - 0) * 2
  const score = ruleWeight * 2;

  // Clamp the score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Asserts database state against expectations after replay.
 */
async function assertDatabaseState(
  processedEventIds: string[], // IDs of events sent (may include duplicates from fixtures)
  uniqueFixtureEventIds: Set<string>,
  expectedAlertsManifest: Record<string, string[]>,
): Promise<void> {
  console.log('\n--- Asserting Database State ---');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase URL or Service Role Key not configured in environment.');
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    // Check added here as secret is needed for signature generation earlier
    throw new Error('STRIPE_TEST_WEBHOOK_SECRET not configured in environment.');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Check events_raw count (should match unique fixtures processed)
  // Query based on the event IDs we actually sent
  const { count: rawCount, error: rawError } = await supabase
    .from('event_buffer') // Changed from events_raw based on webhook code review
    .select('stripe_event_id', { count: 'exact', head: true })
    .in('stripe_event_id', Array.from(uniqueFixtureEventIds)); // Filter by unique IDs from fixtures

  if (rawError) throw new Error(`Error querying event_buffer count: ${rawError.message}`);
  console.log(
    `[ASSERT] Event Buffer Count: Expected=${uniqueFixtureEventIds.size}, Actual=${rawCount}`,
  );
  if (rawCount !== uniqueFixtureEventIds.size) {
    console.warn(
      `  WARN: Event buffer count (${rawCount}) does not match unique fixture count (${uniqueFixtureEventIds.size}). Deduplication might be incorrect or events missed.`,
    );
    // Decide if this should be a hard failure depending on strictness
    // throw new Error('Event buffer count mismatch');
  } else {
    console.log('  ✅ OK');
  }

  // 2. Check alerts count and details
  // Fetch all alerts linked to the unique event IDs from fixtures
  const { data: actualAlerts, error: alertError } = await supabase
    .from('alerts')
    .select('event_id, alert_type, risk_score, stripe_account_id') // Select needed fields
    .in('event_id', Array.from(uniqueFixtureEventIds)); // Filter by unique IDs from fixtures

  if (alertError) throw new Error(`Error querying alerts: ${alertError.message}`);
  console.log(
    `[ASSERT] Alerts Generated: Found ${actualAlerts?.length ?? 0} alerts in DB for replayed events.`,
  );

  // 3. Verify against YAML manifest
  let expectedAlertCount = 0;
  const alertMap: Record<string, { type: string; score: number | null; accountId: string }[]> = {};
  for (const alert of actualAlerts || []) {
    if (!alert.event_id) continue;
    if (!alertMap[alert.event_id]) {
      alertMap[alert.event_id] = [];
    }
    alertMap[alert.event_id].push({
      type: alert.alert_type,
      score: alert.risk_score,
      accountId: alert.stripe_account_id,
    });
  }

  let matchCount = 0;
  let missingCount = 0;
  let unexpectedCount = 0;
  let duplicateAlertsFound = false;
  let scoreMismatchCount = 0;

  // Check expected alerts
  for (const eventId of uniqueFixtureEventIds) {
    const expectedTypes = expectedAlertsManifest[eventId] || [];
    const actualTypesForEvent = alertMap[eventId]?.map((a) => a.type) || [];
    expectedAlertCount += expectedTypes.length;

    // Check for duplicates in actual alerts for this event
    const typeCounts = actualTypesForEvent.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    for (const type in typeCounts) {
      if (typeCounts[type] > 1) {
        console.error(
          `  ❌ FAIL: Duplicate alert found! Event ID: ${eventId}, Alert Type: ${type}`,
        );
        duplicateAlertsFound = true;
      }
    }

    // Compare expected vs actual
    for (const expectedType of expectedTypes) {
      const foundIndex = actualTypesForEvent.indexOf(expectedType);
      if (foundIndex !== -1) {
        matchCount++;
        const actualAlert = alertMap[eventId]?.find((a) => a.type === expectedType);
        if (actualAlert) {
          const expectedScore = calculateExpectedRiskScore(expectedType, actualAlert.accountId);
          // Check if score is defined and within a tolerance (e.g., +/- 1)
          if (
            actualAlert.score === null ||
            actualAlert.score === undefined ||
            Math.abs(actualAlert.score - expectedScore) > 1
          ) {
            console.error(
              `  ❌ FAIL: Risk Score Mismatch! Event: ${eventId}, Type: ${expectedType}, Expected: ~${expectedScore}, Actual: ${actualAlert.score}`,
            );
            scoreMismatchCount++;
          }
        }
        // Remove matched type to detect unexpected ones later
        actualTypesForEvent.splice(foundIndex, 1);
      } else {
        missingCount++;
        console.error(
          `  ❌ FAIL: Missing expected alert! Event ID: ${eventId}, Expected Type: ${expectedType}`,
        );
      }
    }
    // Any remaining actual types are unexpected
    if (actualTypesForEvent.length > 0) {
      unexpectedCount += actualTypesForEvent.length;
      console.error(
        `  ❌ FAIL: Unexpected alert(s) found! Event ID: ${eventId}, Unexpected Types: ${actualTypesForEvent.join(', ')}`,
      );
    }
  }

  console.log(
    `[ASSERT] Alert Comparison: Expected=${expectedAlertCount}, Matched=${matchCount}, Missing=${missingCount}, Unexpected=${unexpectedCount}, Score Mismatches=${scoreMismatchCount}`,
  );

  if (missingCount > 0 || unexpectedCount > 0 || duplicateAlertsFound || scoreMismatchCount > 0) {
    throw new Error('Alert assertion failed. Check logs for details.');
  } else {
    console.log('  ✅ OK: All expected alerts generated correctly with expected scores.');
  }
}

// --- Main Execution ---

async function main() {
  // --- Pre-checks ---
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Error: STRIPE_TEST_WEBHOOK_SECRET is not set in .env.local');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'Error: Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) not set in .env.local',
    );
    process.exit(1);
  }

  const fixtureFiles = (await fs.readdir(FIXTURE_DIR)).filter((f) => f.endsWith('.json'));
  if (fixtureFiles.length === 0) {
    console.error(`Error: No JSON fixtures found in ${FIXTURE_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${fixtureFiles.length} fixture files in ${FIXTURE_DIR}`);

  // Load expected alerts manifest
  let expectedAlertsManifest: Record<string, string[]> = {};
  try {
    const yamlContent = readFileSync(EXPECTED_ALERTS_PATH, 'utf8');
    expectedAlertsManifest = yaml.load(yamlContent) as Record<string, string[]>;
    console.log(`Loaded expected alerts manifest from ${EXPECTED_ALERTS_PATH}`);
  } catch (error) {
    console.error(
      `Error loading expected alerts manifest from ${EXPECTED_ALERTS_PATH}: ${error.message}`,
    );
    process.exit(1);
  }

  const processedEventIds: string[] = [];
  const uniqueFixtureEventIds = new Set<string>();

  console.log(`\n--- Sending ${fixtureFiles.length} events to ${WEBHOOK_URL} ---`);
  for (const file of fixtureFiles) {
    const filePath = path.join(FIXTURE_DIR, file);
    try {
      const rawPayload = await fs.readFile(filePath, 'utf-8');
      const payload = JSON.parse(rawPayload);
      const eventId = payload.id; // Assuming payload has an 'id' field

      if (!eventId) {
        console.warn(`  WARN: Fixture ${file} is missing 'id' field. Skipping.`);
        continue;
      }

      processedEventIds.push(eventId); // Track all processed IDs (incl. duplicates)
      uniqueFixtureEventIds.add(eventId); // Track unique IDs

      const signature = generateStripeSignature(rawPayload, STRIPE_WEBHOOK_SECRET);
      await sendEvent(payload, signature);
      // Optional: add a small delay between sends if needed
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  Error processing fixture ${file}:`, error);
      // Decide if one error should stop the whole script
      // process.exit(1);
    }
  }

  console.log(
    `\nFinished sending events. Processed ${processedEventIds.length} total payloads (${uniqueFixtureEventIds.size} unique event IDs).`,
  );

  await waitForQueueDrained();
  await assertDatabaseState(processedEventIds, uniqueFixtureEventIds, expectedAlertsManifest);

  console.log('\n✅ Replay script finished successfully! ✅');
  // Optional: Disconnect queue if needed
  // await disconnectQueue();
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error);
  // Optional: Disconnect queue if needed
  // disconnectQueue().finally(() => process.exit(1));
  process.exit(1);
});
