import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Stripe from 'stripe';
import { rotateAccountWebhook } from '@/lib/stripe-webhook';
import { logger } from '@/lib/logger';

// Helper to get the authenticated user
async function getUser() {
  const supabase = createClient();
  return await supabase.auth.getUser();
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // Verify user is authenticated
    const {
      data: { user },
    } = await getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify ownership of the account
    const { data: ca } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token')
      .eq('stripe_account_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!ca) {
      logger.warn({ userId: user.id, accountId: params.id }, 'Unauthorized account access attempt');
      return new Response('Forbidden', { status: 403 });
    }

    // Rotate the webhook endpoint
    const { id: webhookId, secret } = await rotateAccountWebhook(params.id, ca.access_token!);

    // Update the webhook secret in the database
    await supabaseAdmin
      .from('connected_accounts')
      .update({ webhook_secret: secret })
      .eq('stripe_account_id', params.id);

    logger.info(
      { accountId: params.id, webhookId: webhookId },
      'Webhook secret rotated successfully',
    );

    return Response.json({ id: webhookId, success: true });
  } catch (error) {
    logger.error({ accountId: params.id, error }, 'Error rotating webhook secret');
    return new Response('Internal Server Error', { status: 500 });
  }
}
