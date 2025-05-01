'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createStripeOAuth } from '@/lib/stripe';
import { supabaseServer } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export async function linkStripeAccountServerAction() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      }
    );
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return { error: 'Authentication required' };
    }

    // Check account limit (assuming a table with stripe_account_id field)
    const { count, error: countError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting accounts:', countError);
      return { error: 'Could not verify account limits' };
    }

    const MAX_ACCOUNTS = 2; // Beta limit
    if (count !== null && count >= MAX_ACCOUNTS) {
      return { error: `You can connect a maximum of ${MAX_ACCOUNTS} accounts during beta` };
    }

    // Get OAuth URL from Stripe client
    const stripeOAuthClient = createStripeOAuth();
    const url = await stripeOAuthClient.getAuthUrl(user.id);
    
    return { url };
  } catch (error) {
    console.error('Error in linkStripeAccountServerAction:', error);
    return { error: 'Failed to start Stripe connection' };
  }
} 