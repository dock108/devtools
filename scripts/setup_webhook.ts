#!/usr/bin/env ts-node
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to load from .env.local first (for local development)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

// Then load from .env (fallback)
dotenv.config();

/**
 * Guardian events copy to avoid import issues
 */
const GUARDIAN_EVENTS = [
  // Payout events
  'payout.created',
  'payout.updated',
  'payout.paid',
  'payout.failed',

  // Account events
  'account.updated',
  'account.external_account.created',
  'account.external_account.updated',
  'account.external_account.deleted',

  // Charge events
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',
  'charge.captured',
  'charge.dispute.created',
];

// Default base URL for local development
const DEFAULT_BASE_URL = 'http://localhost:3000';

/**
 * Setup Stripe webhook for Guardian
 *
 * This script:
 * 1. Finds or creates a webhook endpoint on the Stripe platform account
 * 2. Configures it to listen only to events needed by Guardian
 * 3. Prints the webhook secret for manual addition to .env file
 */
async function setupWebhook() {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment');
    console.log('Please set STRIPE_SECRET_KEY in your .env.local file');
    process.exit(1);
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: '2023-10-16',
  });

  // Get base URL from environment or use default
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://dock108.ai';

  const webhookUrl = `${baseUrl}/api/stripe/webhook`;
  console.log(`\n🔍 Looking for existing webhook endpoint at ${webhookUrl}...`);

  // Find existing webhook endpoints
  const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

  // Check if our webhook already exists
  let webhookEndpoint = webhooks.data.find((webhook) => webhook.url === webhookUrl);
  let webhookSecret: string | undefined;

  // Cast string[] to Stripe's EnabledEvent[] type
  const guardianEvents = GUARDIAN_EVENTS as Stripe.WebhookEndpointCreateParams.EnabledEvent[];

  if (webhookEndpoint) {
    console.log(`✅ Found existing webhook endpoint: ${webhookEndpoint.id}`);

    // Check for event drift - compare configured events with desired events
    const hasAllRequiredEvents = GUARDIAN_EVENTS.every((event) =>
      webhookEndpoint!.enabled_events.includes(event as any),
    );

    const hasExtraEvents = webhookEndpoint.enabled_events.some(
      (event) => !GUARDIAN_EVENTS.includes(event as any),
    );

    if (!hasAllRequiredEvents || hasExtraEvents) {
      console.log('⚠️ Webhook events are out of sync with GUARDIAN_EVENTS');
      console.log('Updating webhook to match canonical event list...');

      // Update the webhook with the correct events
      webhookEndpoint = await stripe.webhookEndpoints.update(webhookEndpoint.id, {
        enabled_events: guardianEvents,
      });

      console.log('✅ Webhook events updated successfully');
    } else {
      console.log('✅ Webhook events are correctly configured');
    }
  } else {
    // Create new webhook endpoint
    console.log(`🔧 Creating new webhook endpoint at ${webhookUrl}...`);

    try {
      webhookEndpoint = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: guardianEvents,
        description: 'Guardian fraud detection webhook (auto-configured)',
      });

      webhookSecret = webhookEndpoint.secret;
      console.log(`✅ Created new webhook endpoint: ${webhookEndpoint.id}`);
    } catch (error) {
      console.error('❌ Failed to create webhook endpoint:', error);
      process.exit(1);
    }
  }

  // If we didn't get a secret from creation, retrieve one
  if (!webhookSecret && process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('ℹ️ Using existing webhook secret from environment');
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  } else if (!webhookSecret) {
    console.log('⚠️ Webhook secret not available');
    console.log('ℹ️ You need to manually get a webhook secret from Stripe Dashboard');
  }

  // Print the webhook configuration for manual addition to .env
  console.log('\n📋 Webhook Configuration');
  console.log('=======================');
  console.log('Add these to your local .env.local file:');

  // Redact sensitive keys for security
  const redactKey = (key: string | undefined): string => {
    if (!key) return '<not available>';
    const firstChars = key.substring(0, 7);
    const lastChars = key.substring(key.length - 4);
    return `${firstChars}...${lastChars}`;
  };

  console.log(`STRIPE_SECRET_KEY=${redactKey(apiKey)}`);
  if (webhookSecret) {
    console.log(`STRIPE_WEBHOOK_SECRET=${redactKey(webhookSecret)}`);
  } else {
    console.log('STRIPE_WEBHOOK_SECRET=<get from Stripe Dashboard>');
  }

  console.log('\n🧩 Webhook Details:');
  console.log(`URL: ${webhookUrl}`);
  console.log(`Webhook ID: ${webhookEndpoint.id}`);
  console.log(`Enabled Events: ${GUARDIAN_EVENTS.length} events configured`);

  console.log('\n✅ Setup complete!');
}

// Run the script
setupWebhook().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
