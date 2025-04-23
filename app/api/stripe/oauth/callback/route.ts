import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAccountWebhook } from '@/lib/stripe-webhook';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    // Parse URL params
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = cookies().get('guardian_oauth_state')?.value;

    // Validate state to prevent CSRF attacks
    if (!code || !state || state !== storedState) {
      return new Response('Bad OAuth state', { status: 400 });
    }

    // Initialize Stripe client
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
      apiVersion: '2024-04-10'
    });

    // Exchange code for access token
    const token = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code
    });

    // Get the current user
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    logger.info({ accountId: token.stripe_user_id }, 'Connected Stripe account via OAuth');

    // Store the tokens in the database
    await supabaseAdmin.from('connected_accounts').upsert({
      user_id: user.id,
      stripe_account_id: token.stripe_user_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      live: token.livemode,
    });

    // Seed alert_channels row if missing
    await supabaseAdmin.from('alert_channels').upsert({
      stripe_account_id: token.stripe_user_id,
      email_to: user.email,
    });

    // Create the webhook endpoint for the connected account
    const { id: wh_id, secret } = await createAccountWebhook(token.stripe_user_id);
    
    // Store the webhook secret in the database
    await supabaseAdmin.from('connected_accounts')
      .update({ webhook_secret: secret })
      .eq('stripe_account_id', token.stripe_user_id);
      
    logger.info({ accountId: token.stripe_user_id, webhookId: wh_id }, 'Created webhook endpoint for connected account');

    // Clear the state cookie
    const response = new Response(
      `<html>
        <head>
          <title>Connected Successfully</title>
          <meta http-equiv="refresh" content="0;url=/stripe-guardian/settings/accounts">
        </head>
        <body>
          <p>Connection successful. Redirecting to your accounts...</p>
          <script>window.location="/stripe-guardian/settings/accounts"</script>
        </body>
      </html>`,
      { 
        status: 200, 
        headers: { 'Content-Type': 'text/html' } 
      }
    );

    // Clear the state cookie
    cookies().delete('guardian_oauth_state');

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    logger.error({ error }, 'OAuth callback error');
    return new Response('OAuth error', { status: 500 });
  }
} 