import Stripe from 'stripe';
import { stripeAdmin } from '@/lib/stripe'; // platform secret key
import { logger } from '@/lib/logger';

/**
 * Creates a webhook endpoint on a connected Stripe account
 * @param connectedAccountId The Stripe account ID to create the webhook on
 * @returns The webhook ID and secret
 */
export async function createAccountWebhook(
  connectedAccountId: string,
): Promise<{ id: string; secret: string }> {
  logger.info({ accountId: connectedAccountId }, 'Creating webhook endpoint for connected account');

  const wh = await stripeAdmin.webhookEndpoints.create(
    {
      enabled_events: ['payout.*', 'charge.*', 'external_account.created'],
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/webhook`,
    },
    { stripeAccount: connectedAccountId },
  );

  // Retrieve secret once
  const secret = (wh as any).secret as string;

  logger.info(
    { accountId: connectedAccountId, webhookId: wh.id },
    'Webhook endpoint created successfully',
  );

  return { id: wh.id, secret };
}

/**
 * Rotates the webhook endpoint for a connected account
 * @param connectedAccountId The Stripe account ID
 * @param accessToken The Stripe access token for the connected account
 * @returns The new webhook ID and secret
 */
export async function rotateAccountWebhook(
  connectedAccountId: string,
  accessToken: string,
): Promise<{ id: string; secret: string }> {
  logger.info({ accountId: connectedAccountId }, 'Rotating webhook endpoint for connected account');

  // Delete existing webhooks
  const stripe = new Stripe(accessToken, { apiVersion: '2024-04-10' });
  const webhooks = await stripe.webhookEndpoints.list();

  for (const webhook of webhooks.data) {
    logger.info(
      { accountId: connectedAccountId, webhookId: webhook.id },
      'Deleting existing webhook',
    );
    await stripe.webhookEndpoints.del(webhook.id);
  }

  // Create new webhook
  const result = await createAccountWebhook(connectedAccountId);

  logger.info(
    { accountId: connectedAccountId, webhookId: result.id },
    'Webhook endpoint rotated successfully',
  );

  return result;
}
