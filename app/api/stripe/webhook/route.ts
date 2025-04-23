import { NextRequest, NextResponse } from 'next/server';
import { stripe, Stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { logRequest } from '@/lib/logRequest';
import { evaluateRulesEdge } from '@/lib/guardian/rules/edge';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  logRequest(req);
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  const accountId = req.headers.get('stripe-account');
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch (err) {
    logger.error({ err }, 'Failed to read request body');
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event;
  
  try {
    if (!sig) throw new Error('Missing signature header');
    
    // If this is a connected account webhook, look up its secret
    if (accountId) {
      logger.info({ accountId }, 'Handling connected account webhook');
      
      // Look up the webhook secret for this account
      const { data: account, error } = await supabaseAdmin
        .from('connected_accounts')
        .select('webhook_secret')
        .eq('stripe_account_id', accountId)
        .maybeSingle();
      
      if (error || !account || !account.webhook_secret) {
        logger.error({ accountId, error }, 'Failed to find webhook secret for account');
        throw new Error('Invalid account or missing webhook secret');
      }
      
      // Verify signature using the account-specific webhook secret
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        account.webhook_secret
      );
      
      logger.info({ accountId, eventType: event.type }, 'Connected account webhook verified');
    } else {
      // This is a platform webhook, use the platform webhook secret
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      
      logger.info({ eventType: event.type }, 'Platform webhook verified');
    }
  } catch (err) {
    logger.error({ err, accountId }, 'Webhook signature verification failed');
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  try {
    const { id: stripeEventId, type, created, data, account } = event;

    // Only process the events we care about for Guardian
    if (type.startsWith('payout.') || 
        type === 'account.updated' || 
        type === 'account.external_account.created') {
      
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
      const stripeAccountId = accountId || account || 
        (data.object && 'account' in data.object ? data.object.account : '');
      
      // Only proceed if we have valid account ID and either a payout ID or it's an account event
      if (stripeAccountId && (stripePayoutId || type === 'account.updated' || type === 'account.external_account.created')) {
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
        
        // Evaluate rules and store alerts using Edge-compatible implementation
        const alerts = await evaluateRulesEdge(event);
        if (alerts.length > 0) {
          const { error: alertError } = await supabaseAdmin.from('alerts').insert(alerts);
          if (alertError) {
            logger.error({ alertError }, 'Failed to insert alerts into database');
          }
          // TODO send via Slack/email later
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to insert event into database');
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
} 