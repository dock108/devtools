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
  const next = requestUrl.searchParams.get('next') || '/dashboard';

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

  if (error) {
    console.error(`Auth Error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || 'An error occurred during login')}`, requestUrl.origin)
    );
  }

  if (!code) {
    console.error('Missing auth code');
    return NextResponse.redirect(
      new URL('/login?error=missing_code&error_description=No code returned from authentication provider.', requestUrl.origin)
    );
  }

  try {
    // This handles both email confirmation and OAuth flows
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      throw error;
    }

    // Check if user exists in users table, if not create them
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', user.id)
        .single();

      if (!existingUser) {
        // Create new user record
        await supabase
          .from('users')
          .insert({
            auth_uid: user.id,
            tier: 'free',
          });
      }
    }

    // Redirect to dashboard after successful email confirmation or login
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (error: any) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=callback_error&error_description=${encodeURIComponent(error.message || 'An error occurred during login')}`, requestUrl.origin)
    );
  }
}
