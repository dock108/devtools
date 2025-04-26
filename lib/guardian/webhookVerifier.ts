import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { GUARDIAN_EVENTS } from './stripeEvents';

/**
 * Verifies that the configured Stripe webhook matches the Guardian events
 *
 * This should be run on application startup to detect configuration drift
 */
export async function verifyWebhookConfiguration() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Skipping webhook verification - missing Stripe credentials');
    return;
  }

  try {
    // Get base URL from environment
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const webhookUrl = `${baseUrl}/api/stripe/webhook`;

    // List webhook endpoints
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

    // Find our webhook
    const webhookEndpoint = webhooks.data.find((webhook) => webhook.url === webhookUrl);

    if (!webhookEndpoint) {
      logger.warn(
        { webhookUrl },
        'Guardian webhook endpoint not found. Run scripts/setup_webhook.ts',
      );
      return;
    }

    // Check for event drift
    const configuredEvents = webhookEndpoint.enabled_events;

    // Missing events that should be enabled
    const missingEvents = GUARDIAN_EVENTS.filter((event) => !configuredEvents.includes(event));

    // Extra events that shouldn't be enabled
    const extraEvents = configuredEvents.filter((event) => !GUARDIAN_EVENTS.includes(event));

    if (missingEvents.length > 0 || extraEvents.length > 0) {
      logger.warn(
        {
          webhookId: webhookEndpoint.id,
          missingEvents,
          extraEvents,
          expected: GUARDIAN_EVENTS,
          actual: configuredEvents,
        },
        'webhook-event-drift: Webhook event configuration mismatch',
      );
    } else {
      logger.info({ webhookId: webhookEndpoint.id }, 'Webhook event configuration verified');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to verify webhook configuration');
  }
}
