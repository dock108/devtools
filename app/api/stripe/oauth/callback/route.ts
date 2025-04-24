import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAccountWebhook } from '@/lib/stripe-webhook';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    // Parse URL params
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieStore = cookies();
    const storedState = cookieStore.get('guardian_oauth_state')?.value;

    // Validate state to prevent CSRF attacks
    if (!code || !state || state !== storedState) {
      logger.warn({ code, state, storedState }, 'OAuth state mismatch or missing code');
      // Redirect to login with error message
      const redirectUrl = new URL('/login', url.origin);
      redirectUrl.searchParams.set('error', 'oauth_state_mismatch');
      return NextResponse.redirect(redirectUrl);
    }

    // --- 1️⃣ Read session from cookie (server-side) --- 
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // No need for set/remove in read-only scenario
        },
      }
    );
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (!session || sessionError) {
      logger.warn({ error: sessionError }, 'No valid session found during OAuth callback');
      // No valid cookie – ask user to login again
      const redirectUrl = new URL('/login', url.origin);
      redirectUrl.searchParams.set('error', 'session_expired');
      redirectUrl.searchParams.set('redirectTo', '/stripe-guardian/onboard');
      return NextResponse.redirect(redirectUrl);
    }

    // --- 2️⃣ Exchange OAuth code for tokens --- 
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
      apiVersion: '2024-04-10'
    });
    const token = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code
    });

    logger.info({ accountId: token.stripe_user_id, userId: session.user.id }, 'Exchanged OAuth code for Stripe tokens');

    // --- 3️⃣ Upsert connected account row --- 
    await supabaseAdmin.from('connected_accounts').upsert({
      user_id: session.user.id, // Use server-side session user id
      stripe_account_id: token.stripe_user_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      live: token.livemode,
    });

    // Seed alert_channels row if missing
    await supabaseAdmin.from('alert_channels').upsert({
      stripe_account_id: token.stripe_user_id,
      email_to: session.user.email, // Use server-side session user email
    });

    // Create the webhook endpoint for the connected account
    const { id: wh_id, secret } = await createAccountWebhook(token.stripe_user_id);
    
    // Store the webhook secret in the database
    await supabaseAdmin.from('connected_accounts')
      .update({ webhook_secret: secret })
      .eq('stripe_account_id', token.stripe_user_id);
      
    logger.info({ accountId: token.stripe_user_id, webhookId: wh_id }, 'Created webhook endpoint for connected account');

    // --- 4️⃣ Cleanup + redirect --- 
    // Redirect to the main dashboard after successful connection
    const redirectUrl = new URL('/stripe-guardian/alerts', url.origin);
    redirectUrl.searchParams.set('first', '1');
    const response = NextResponse.redirect(redirectUrl);
    
    // Clear the state cookie using the Response object for proper Set-Cookie header
    response.cookies.set({
      name: 'guardian_oauth_state',
      value: '',
      path: '/',
      maxAge: -1, // Expire the cookie immediately
    });

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    logger.error({ error }, 'OAuth callback error');
    // Redirect to login page with a generic error
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(redirectUrl);
  }
} 