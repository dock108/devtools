import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe'; // Assuming stripe client is configured
import { getErrorRedirect, getStatusRedirect } from '@/utils/helpers'; // Assumed helpers
import { Database } from '@/types/supabase'; // Assuming generated types
import { createAdminClient } from '@/lib/supabase/admin'; // Assuming admin client for inserts
import { createWebhookIfMissing } from '@/lib/stripe/webhooks';
import { enqueueBackfill } from '@/lib/guardian/backfill';

// TODO: Import actual functions when created
// import { enqueueBackfill } from '@/lib/guardian/backfill';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  const cookieStore = cookies();

  // Use the recommended cookie handling methods for Route Handlers with ssr client
  const supabase = createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );

  // 1. Handle OAuth errors from Stripe
  if (error) {
    console.error(`Stripe OAuth Error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(
      getErrorRedirect(requestUrl.origin, error, errorDescription || 'Unknown Stripe Error'),
    );
  }

  // 2. Handle missing code
  if (!code) {
    console.error('Missing OAuth code in callback');
    return NextResponse.redirect(
      getErrorRedirect(requestUrl.origin, 'OAuth Error', 'No code returned from Stripe.'),
    );
  }

  try {
    // 3. Exchange code for tokens
    console.log('Exchanging OAuth code for Stripe tokens...');
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });
    console.log('Stripe token exchange successful:', response.stripe_user_id);

    const stripeAccountId = response.stripe_user_id;
    const refreshToken = response.refresh_token; // Store securely!
    const accessToken = response.access_token; // Store securely!
    const scope = response.scope;

    if (!stripeAccountId) {
      throw new Error('Stripe account ID not found in OAuth response.');
    }
    if (!refreshToken) {
      throw new Error('Stripe refresh token not found in OAuth response.');
    }
    if (!accessToken) {
      throw new Error('Stripe access token not found in OAuth response.');
    }

    // 4. Get Supabase User
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.redirect(
        getErrorRedirect(requestUrl.origin, 'Authentication Error', 'Could not get user session.'),
      );
    }
    console.log('Supabase user found:', user.id);

    // Use Admin client for DB operations from server-side route
    const supabaseAdmin = createAdminClient();

    // 5. Check account limit (<= 2)
    console.log(`Checking account limit for user ${user.id}...`);
    const { count, error: countError } = await supabaseAdmin
      .from('stripe_accounts') // Assuming this table exists
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting Stripe accounts:', countError);
      throw new Error('Could not verify account limit.'); // Internal error
    }

    const MAX_ACCOUNTS = 2;
    if (count !== null && count >= MAX_ACCOUNTS) {
      console.warn(`User ${user.id} has reached account limit (${count}/${MAX_ACCOUNTS}).`);
      return NextResponse.redirect(
        getErrorRedirect(
          requestUrl.origin,
          'Account Limit Reached',
          `You can connect a maximum of ${MAX_ACCOUNTS} Stripe accounts.`,
          '/dashboard',
        ),
      );
    }
    console.log(`User ${user.id} has ${count ?? 0} accounts, proceeding.`);

    // 6. Insert/Update Stripe Account Info (encrypt tokens!)
    const keyId = process.env['SODIUM_ENCRYPTION_KEY_ID'];
    if (!keyId) {
      console.error('SODIUM_ENCRYPTION_KEY_ID is not set in environment variables.');
      throw new Error('Server configuration error for encryption.');
    }

    console.log(`Upserting Stripe account ${stripeAccountId} for user ${user.id}...`);
    const { error: upsertError } = await supabaseAdmin.rpc('upsert_stripe_account', {
      p_user_id: user.id,
      p_stripe_account_id: stripeAccountId,
      p_scope: scope,
      p_refresh_token: refreshToken,
      p_access_token: accessToken,
      p_key_id: keyId,
    });

    if (upsertError) {
      console.error('Error upserting Stripe account:', upsertError);
      throw new Error(`Failed to save Stripe account details: ${upsertError.message}`);
    }
    console.log(`Successfully upserted Stripe account ${stripeAccountId}`);

    // 7. Provision Webhook
    console.log(`Provisioning webhook for account ${stripeAccountId}...`);
    await createWebhookIfMissing(stripeAccountId);
    console.log(`Webhook provisioning step completed for ${stripeAccountId}.`);

    // 8. Enqueue Backfill & Create initial status record
    console.log(`Enqueueing backfill for account ${stripeAccountId}...`);
    await enqueueBackfill(user.id, stripeAccountId);
    console.log(`Backfill enqueue step completed for ${stripeAccountId}.`);

    // 9. Redirect on success
    console.log(`Redirecting to dashboard for user ${user.id}, account ${stripeAccountId}`);
    return NextResponse.redirect(
      getStatusRedirect(
        requestUrl.origin,
        'Stripe Account Connected',
        `Successfully connected ${stripeAccountId}. Historical data back-fill initiated.`,
      ),
    );
  } catch (err: any) {
    console.error('Error during Stripe OAuth callback:', err);
    const message = err.message || 'An unexpected error occurred during Stripe Connect.';
    return NextResponse.redirect(getErrorRedirect(requestUrl.origin, 'Connection Failed', message));
  }
}
