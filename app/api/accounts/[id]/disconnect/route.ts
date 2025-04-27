import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

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
    const { data: ca, error: fetchError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, stripe_account_id')
      .eq('stripe_account_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !ca) {
      logger.warn({ userId: user.id, accountId: params.id }, 'Unauthorized account access attempt');
      return new Response('Forbidden', { status: 403 });
    }

    try {
      // Deauthorize the connected account in Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-04-10',
      });

      await stripe.oauth.deauthorize({
        client_id: process.env.STRIPE_CLIENT_ID!,
        stripe_user_id: ca.stripe_account_id,
      });

      logger.info({ accountId: params.id }, 'Deauthorized account in Stripe');
    } catch (stripeError) {
      // Log error but continue with database cleanup
      logger.error(
        { accountId: params.id, error: stripeError },
        'Error deauthorizing account in Stripe',
      );
    }

    // Delete the account from our database
    const { error: deleteError } = await supabaseAdmin
      .from('connected_accounts')
      .delete()
      .eq('stripe_account_id', params.id);

    if (deleteError) {
      throw deleteError;
    }

    logger.info({ accountId: params.id }, 'Disconnected account successfully');

    return Response.json({ success: true });
  } catch (error) {
    logger.error({ accountId: params.id, error }, 'Error disconnecting account');
    return new Response('Internal Server Error', { status: 500 });
  }
}
