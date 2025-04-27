import { stripe } from '@/lib/stripe';
import { log } from '@/lib/logger'; // Assuming a logger exists

const REQUIRED_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'payout.created',
  'payout.paid',
  'payout.failed',
  'charge.failed',
  'account.updated',
  // Add any other events Guardian needs
];

const getWebhookUrl = (): string => {
  const deploymentUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (!deploymentUrl) {
    throw new Error('Missing NEXT_PUBLIC_SITE_URL or VERCEL_URL for webhook configuration.');
  }
  // Ensure correct protocol (https for production)
  const protocol = deploymentUrl.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${deploymentUrl}/api/stripe/webhook`;
};

/**
 * Checks if a webhook endpoint exists for the required events and URL,
 * creates one if it doesn't.
 * Uses the Stripe Account context for the operation.
 */
export async function createWebhookIfMissing(stripeAccountId: string): Promise<void> {
  const targetUrl = getWebhookUrl();
  log.info({ stripeAccountId, targetUrl }, 'Checking for existing webhook endpoint...');

  try {
    // Check existing webhooks for the connected account
    const { data: existingEndpoints } = await stripe.webhookEndpoints.list(
      { limit: 100 }, // Fetch up to 100, should be enough for most cases
      { stripeAccount: stripeAccountId },
    );

    const existing = existingEndpoints.find(
      (ep) =>
        ep.url === targetUrl &&
        ep.status === 'enabled' &&
        REQUIRED_WEBHOOK_EVENTS.every((event) => ep.enabled_events.includes(event)),
    );

    if (existing) {
      log.info(
        { stripeAccountId, webhookId: existing.id },
        'Required webhook endpoint already exists and is enabled.',
      );
      return;
    }

    log.info({ stripeAccountId, targetUrl }, 'No suitable webhook found, creating new endpoint...');

    // If multiple partial matches exist, consider updating one instead of creating new?
    // For simplicity here, we just create a new one if no perfect match is found.

    const newEndpoint = await stripe.webhookEndpoints.create(
      {
        url: targetUrl,
        enabled_events: REQUIRED_WEBHOOK_EVENTS,
        description: 'DOCK108 Stripe Guardian Webhook',
        // api_version: '2023-10-16', // Optionally pin API version
      },
      { stripeAccount: stripeAccountId },
    );

    log.info(
      { stripeAccountId, webhookId: newEndpoint.id },
      'Successfully created new webhook endpoint.',
    );
  } catch (error: any) {
    log.error(
      { stripeAccountId, error: error.message },
      'Failed to list or create Stripe webhook endpoint.',
    );
    // Decide if this should be a critical error blocking onboarding
    // For now, we log the error but allow onboarding to continue.
    // Consider adding a status to stripe_accounts table to indicate webhook setup failure.
    // throw new Error(`Failed to configure Stripe webhook: ${error.message}`);
  }
}
