import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import Stripe from 'stripe';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
  typescript: true,
});

const siteUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// Log required env vars on cold start (duplicate from checkout, but ok)
if (!process.env.STRIPE_PRICE_PRO || !process.env.STRIPE_WEBHOOK_BILLING) {
  console.warn(`
    ************************************************************
    * WARNING: Missing Stripe Billing Environment Variables!   *
    * (STRIPE_PRICE_PRO, STRIPE_WEBHOOK_BILLING)               *
    * See console logs from /api/billing/checkout for details. *
    ************************************************************
    `);
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the Stripe Customer ID from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('stripe_customer_id')
      .eq('id', 'global_settings') // Adjust if settings are per-user
      // .eq('user_id', user.id)
      .single();

    if (settingsError || !settings?.stripe_customer_id) {
      console.error(
        'Billing Portal Error: Stripe Customer ID not found for user:',
        user.id,
        settingsError,
      );
      // Optionally, redirect to a page explaining the issue or try creating the customer again.
      return NextResponse.json(
        { error: 'Stripe customer information not found.' },
        { status: 404 },
      );
    }

    const stripeCustomerId = settings.stripe_customer_id;

    // Create a Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/billing`, // URL to return to after managing subscription
    });

    if (!portalSession.url) {
      throw new Error('Failed to create Stripe Billing Portal session URL.');
    }

    // Return the portal session URL
    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Stripe Billing Portal Error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session', details: error.message },
      { status: 500 },
    );
  }
}
