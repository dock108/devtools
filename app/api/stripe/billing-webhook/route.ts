import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
  typescript: true,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_BILLING;

// Initialize Supabase client directly for webhook handling (no user context)
// Use SERVICE_ROLE_KEY for elevated privileges needed to update any settings row
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Helper function to update settings based on Stripe Customer ID
// Adjust the query based on your settings table structure (global vs per-user)
async function updateSettingsByCustomerId(
  customerId: string,
  dataToUpdate: Partial<Database['public']['Tables']['settings']['Row']>,
) {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(dataToUpdate)
    .eq('stripe_customer_id', customerId)
    // If settings are global and might not have customer ID yet, alternative logic needed
    // Maybe: .eq('id', 'global_settings') and then update customer_id too?
    // This assumes customer_id is reliably populated before subscription events.
    .select('id') // Select something to confirm update occurred
    .maybeSingle(); // Use maybeSingle in case the customer ID isn't found (shouldn't happen ideally)

  if (error) {
    console.error(`Webhook Error: Failed to update settings for customer ${customerId}:`, error);
    throw error; // Re-throw to signal failure
  }
  if (!data) {
    console.warn(`Webhook Warning: No settings found for customer ${customerId} during update.`);
  }
  console.log(`Webhook: Successfully updated settings for customer ${customerId}.`);
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error('Webhook Error: STRIPE_WEBHOOK_BILLING secret is not set.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const signature = headers().get('stripe-signature');
  let event: Stripe.Event;

  try {
    const body = await request.text();
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`Webhook Received: ${event.type}`);

  try {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        // Check subscription status
        const status = subscription.status;
        const isPro = status === 'active' || status === 'trialing';

        await updateSettingsByCustomerId(customerId, {
          tier: isPro ? 'pro' : 'free',
          stripe_subscription_id: subscription.id,
          // Reset Slack webhook if plan becomes inactive/non-pro?
          // slack_webhook_url: isPro ? settings.slack_webhook_url : null, // Requires fetching existing settings first
        });
        console.log(
          `Webhook: Set tier to ${isPro ? 'pro' : 'free'} for customer ${customerId} (Sub ID: ${subscription.id})`,
        );
        break;

      case 'customer.subscription.deleted':
        // Subscription cancelled or ended
        await updateSettingsByCustomerId(customerId, {
          tier: 'free',
          stripe_subscription_id: null,
          // Consider nulling out Slack URL here too if it shouldn't persist for free users
          // slack_webhook_url: null,
        });
        console.log(`Webhook: Set tier to free for customer ${customerId} (Sub Deleted)`);
        break;

      // Optional: Handle payment failures specifically if needed
      // case 'invoice.payment_failed':
      //     // Check if it's related to a subscription
      //     if (subscription.id) {
      //         // Could set tier to free or a specific 'payment_failed' status
      //         await updateSettingsByCustomerId(customerId, {
      //             tier: 'free', // Or a custom status
      //             // Consider keeping subscription ID for reactivation attempts?
      //         });
      //         console.log(`Webhook: Payment failed for subscription ${subscription.id}, customer ${customerId}`);
      //     }
      //     break;

      default:
        console.log(`Webhook: Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook Handler Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error.message },
      { status: 500 },
    );
  }
}
