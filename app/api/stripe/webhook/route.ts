import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

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
    console.error('Webhook signature failed', err);
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  try {
    const { id, type, created, data, account } = event as any;
    const amountCents = type === 'payout.paid' ? data.object.amount : null;
    const { error } = await supabaseAdmin.from('guardian_events').insert({
      id,
      type,
      account,
      amount_cents: amountCents,
      event_time: new Date(created * 1000).toISOString(),
      raw: event as unknown as Record<string, unknown>,
    });
    if (error) throw error;
  } catch (err) {
    console.error('DB insert failed', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
} 