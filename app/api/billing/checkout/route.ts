import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import Stripe from 'stripe';

// Initialize Stripe client (ensure STRIPE_SECRET_KEY is set)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10', // Use the latest API version
  typescript: true,
});

const stripePriceIdPro = process.env.STRIPE_PRICE_PRO;
const stripeWebhookSecretBilling = process.env.STRIPE_WEBHOOK_BILLING;
const siteUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// Log required env vars on cold start (will log once per instance)
if (!stripePriceIdPro || !stripeWebhookSecretBilling) {
  // Only show warning in production, not in development or preview
  if (process.env.VERCEL_ENV === 'production') {
    console.warn(`
      ************************************************************
      * WARNING: Missing Stripe Billing Environment Variables!   *
      * Please add the following to your .env.local file:        *
      * STRIPE_PRICE_PRO=<your_stripe_pro_plan_price_id>         *
      * STRIPE_WEBHOOK_BILLING=<your_stripe_billing_webhook_secret> *
      ************************************************************
      `);
  }
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

    // Fetch settings to get the Stripe Customer ID if it exists
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('stripe_customer_id')
      .eq('id', 'global_settings') // Assuming global settings linked to the authenticated user?
      // OR: .eq('user_id', user.id) if settings are per-user
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      // Ignore 'not found' error
      throw settingsError;
    }

    let customerId = settings?.stripe_customer_id;

    // Create a Stripe Customer if one doesn't exist for this user
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        // Add metadata to link Stripe Customer to your Supabase user/account
        metadata: {
          supabaseUserId: user.id,
          // Add other identifiers if needed
        },
      });
      customerId = customer.id;

      // Update the settings table with the new Stripe Customer ID
      // Note: This assumes a single 'global_settings' row. Adjust if settings are per-user.
      const { error: updateError } = await supabase
        .from('settings')
        .update({ stripe_customer_id: customerId })
        .eq('id', 'global_settings');
      // OR: .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to update settings with Stripe Customer ID:', updateError);
        // Proceed with checkout anyway, but log the error
      }
    }

    if (!stripePriceIdPro) {
      throw new Error('Stripe Price ID for Pro plan is not configured.');
    }

    // Create a Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: stripePriceIdPro, // The Price ID for your Pro plan
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/billing?success=true`, // Redirect URL on successful payment
      cancel_url: `${siteUrl}/billing?cancelled=true`, // Redirect URL if the user cancels
      // Allow promotion codes if desired
      // allow_promotion_codes: true,
      // Add metadata if needed
      // subscription_data: {
      //   metadata: { supabaseUserId: user.id }
      // },
    });

    if (!session.url) {
      throw new Error('Failed to create Stripe Checkout session URL.');
    }

    // Return the session URL to redirect the user
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error.message },
      { status: 500 },
    );
  }
}
