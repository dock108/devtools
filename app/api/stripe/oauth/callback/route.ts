import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';
// import { createAccountWebhook } from '@/lib/stripe-webhook'; // Removed as we don't create webhooks programmatically per account
// import { logger } from '@/lib/logger'; // Temporarily commented out

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url); // Define url early for use in error redirects
  console.log('Starting Stripe OAuth callback processing.'); // Replaced logger.info
  try {
    // Parse URL params
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieStore = cookies();
    const storedState = cookieStore.get('guardian_oauth_state')?.value;

    // Validate state to prevent CSRF attacks
    if (!code || !state || state !== storedState) {
      console.warn('OAuth state mismatch or missing code', { code, state, storedState }); // Replaced logger.warn
      const redirectUrl = new URL('/login', url.origin);
      redirectUrl.searchParams.set('error', 'oauth_state_mismatch');
      return NextResponse.redirect(redirectUrl);
    }
    console.log('OAuth state validated successfully.'); // Replaced logger.info

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
    console.log('Attempting to fetch Supabase session...'); // Replaced logger.info
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (!session || sessionError) {
      console.warn('No valid session found during OAuth callback', { error: sessionError, hasSession: !!session }); // Replaced logger.warn
      const redirectUrl = new URL('/login', url.origin);
      redirectUrl.searchParams.set('error', 'session_expired');
      redirectUrl.searchParams.set('redirectTo', '/stripe-guardian/onboard');
      return NextResponse.redirect(redirectUrl);
    }
    console.log('Supabase session fetched successfully.', { userId: session.user.id }); // Replaced logger.info

    // --- 2️⃣ Exchange OAuth code for tokens ---
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-04-10'
    });
    console.log('Exchanging OAuth code for Stripe tokens...'); // Replaced logger.info
    const token = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code
    });
    console.log('Exchanged OAuth code for Stripe tokens successfully.', { accountId: token.stripe_user_id, userId: session.user.id }); // Replaced logger.info

    // --- 2.5️⃣ Retrieve account details to get business name ---
    let businessName: string | null = null;
    try {
      console.log('Retrieving Stripe Account details...', { accountId: token.stripe_user_id });
      const account = await stripe.accounts.retrieve(token.stripe_user_id);
      businessName = account.business_profile?.name ?? null;
      console.log('Retrieved Stripe Account details successfully.', { accountId: token.stripe_user_id, businessName });
    } catch (retrieveError) {
      console.error('Error retrieving Stripe account details:', { accountId: token.stripe_user_id, error: retrieveError });
      // Decide if this is fatal. For now, let's continue without the business name.
    }

    // --- 3️⃣ Upsert connected account row ---
    const accountData = {
      user_id: session.user.id,
      stripe_account_id: token.stripe_user_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      live: token.livemode,
      business_name: businessName, // Add the retrieved business name
    };
    console.log('Attempting to upsert connected_accounts record...', { accountData }); // Replaced logger.info
    const { error: upsertAccountError } = await supabaseAdmin.from('connected_accounts').upsert(accountData);

    if (upsertAccountError) {
      console.error('Error upserting connected_accounts record.', { error: upsertAccountError, accountData }); // Replaced logger.error
      throw upsertAccountError; // Re-throw to be caught by the main catch block
    }
    console.log('Upserted connected_accounts record successfully.', { accountId: token.stripe_user_id }); // Replaced logger.info

    // Seed alert_channels row if missing
    const channelData = {
      stripe_account_id: token.stripe_user_id,
      email_to: session.user.email,
    };
    console.log('Attempting to upsert alert_channels record...', { channelData }); // Replaced logger.info
    const { error: upsertChannelError } = await supabaseAdmin.from('alert_channels').upsert(channelData);
    
    if (upsertChannelError) {
        console.error('Error upserting alert_channels record.', { error: upsertChannelError, channelData }); // Replaced logger.error
        // Decide if this is critical - maybe just log and continue? Or throw?
        // For now, let's log and continue, as the account connection is the primary goal.
    } else {
        console.log('Upserted alert_channels record successfully.', { accountId: token.stripe_user_id }); // Replaced logger.info
    }

    // --- 4️⃣ Cleanup + redirect ---
    console.log('OAuth flow complete, preparing redirect.', { accountId: token.stripe_user_id }); // Replaced logger.info
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

    console.log('Redirecting user to alerts page.', { accountId: token.stripe_user_id }); // Replaced logger.info
    return response;
  } catch (error: any) { // Catch any error type
    // Log the specific error that occurred
    console.error('Caught error during OAuth callback process.', { // Replaced logger.error
        error: error, 
        message: error?.message, 
        stack: error?.stack 
    });
    
    // Redirect to login page with a generic error
    const redirectUrl = new URL('/login', url.origin); // Use url defined at the start
    redirectUrl.searchParams.set('error', 'oauth_failed');
    redirectUrl.searchParams.set('details', 'Check server logs for specifics.'); // Add hint for debugging
    return NextResponse.redirect(redirectUrl);
  }
} 