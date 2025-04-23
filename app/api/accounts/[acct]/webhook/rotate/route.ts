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

export async function POST(
  req: Request, 
  { params }: { params: { acct: string }}
) {
  try {
    // Verify user is authenticated
    const { data: { user } } = await getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify ownership of the account
    const { data: ca } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token')
      .eq('stripe_account_id', params.acct)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!ca) {
      logger.warn({ userId: user.id, accountId: params.acct }, 'Unauthorized account access attempt');
      return new Response('Forbidden', { status: 403 });
    }

    // Rotate the webhook endpoint
    const { id, secret } = await rotateAccountWebhook(params.acct, ca.access_token!);
    
    // Update the webhook secret in the database
    await supabaseAdmin
      .from('connected_accounts')
      .update({ webhook_secret: secret })
      .eq('stripe_account_id', params.acct);
    
    logger.info({ accountId: params.acct, webhookId: id }, 'Webhook secret rotated successfully');
    
    return Response.json({ id, success: true });
  } catch (error) {
    logger.error({ accountId: params.acct, error }, 'Error rotating webhook secret');
    return new Response('Internal Server Error', { status: 500 });
  }
} 