import { NextRequest, NextResponse } from 'next/server';
import { stripe, Stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    if (!sig) throw new Error('Missing signature header');
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('⚠️  Webhook signature failed', err);
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  try {
    const { id: stripeEventId, type, created, data, account } = event;

    // Only process the events we care about for Guardian
    if (type.startsWith('payout.') || 
        type === 'account.updated' || 
        type === 'external_account.created') {
      
      // Extract payout ID for payout events
      let stripePayoutId = '';
      let amount: number | null = null;
      let currency: string | null = null;
      
      if (data.object && 'object' in data.object) {
        if (data.object.object === 'payout') {
          const payoutObj = data.object as Stripe.Payout;
          stripePayoutId = payoutObj.id;
          amount = payoutObj.amount;
          currency = payoutObj.currency;
        }
      }
      
      // Use account ID from the payload or event
      const stripeAccountId = account || 
        (data.object && 'account' in data.object ? data.object.account : '');
      
      // Only proceed if we have valid account ID and either a payout ID or it's an account event
      if (stripeAccountId && (stripePayoutId || type === 'account.updated' || type === 'external_account.created')) {
        // Insert into the payout_events table
        const { error } = await supabaseAdmin.from('payout_events').insert({
          stripe_event_id: stripeEventId,
          stripe_payout_id: stripePayoutId || stripeEventId, // Use event ID as fallback for non-payout events
          stripe_account_id: stripeAccountId,
          type,
          amount,
          currency,
          event_data: data.object,
          created_at: new Date(created * 1000).toISOString()
        });
        
        if (error) throw error;
      }
    }
  } catch (err) {
    console.error('⚠️  DB insert failed', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
} 