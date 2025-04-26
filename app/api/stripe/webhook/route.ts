import { NextRequest, NextResponse } from 'next/server';
import { stripe, Stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { logRequest } from '@/lib/logRequest';
import { performance } from 'perf_hooks';

export const runtime = 'edge';
export const maxDuration = 5; // 5 seconds maximum for the webhook handler

/**
 * Handles Stripe webhook events
 * - Verifies signature
 * - Identifies source account
 * - Stores raw event payload in event_buffer
 * - Forwards to guardian-reactor
 * - Returns 200 OK quickly
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();
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
  let verifiedAccountId: string;

  try {
    if (!sig) {
      logger.error('Missing Stripe signature header');
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
    }

    try {
      // Always use the platform webhook secret for verification
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      logger.error({ err }, 'Webhook signature verification failed');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    // Extract the account ID from header or event
    verifiedAccountId = accountId || event.account || '';

    if (!verifiedAccountId) {
      logger.error({ eventType: event.type }, 'Missing account ID');
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }

    logger.info(
      {
        accountId: verifiedAccountId,
        eventType: event.type,
        eventId: event.id,
      },
      'Webhook verified',
    );
  } catch (err) {
    logger.error({ err }, 'Error processing webhook');
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 400 });
  }

  // Record verification time for performance monitoring
  const verificationTime = performance.now() - startTime;

  // Store the raw event in the buffer
  try {
    const { data: insertedEvent, error } = await supabaseAdmin
      .from('event_buffer')
      .upsert(
        {
          stripe_event_id: event.id,
          stripe_account_id: verifiedAccountId,
          type: event.type,
          payload: event.data,
          received_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_event_id' },
      )
      .select('id')
      .single();

    if (error) {
      logger.error({ error }, 'Failed to insert event into buffer');
      // We don't want to return an error to Stripe, as we've verified the signature
      // Continue to return 200 OK to prevent Stripe from retrying
    } else {
      logger.info(
        {
          eventBufferId: insertedEvent.id,
          eventType: event.type,
          eventId: event.id,
        },
        'Event stored in buffer',
      );

      // Fan out to guardian-reactor (asynchronously)
      if (insertedEvent && insertedEvent.id) {
        // We'll use Promise.race to ensure we respond quickly to Stripe
        // even if the reactor call takes longer
        const timeoutPromise = new Promise<Response>((resolve) => {
          setTimeout(() => {
            // Log that we're responding before the reactor call completes
            logger.info(
              { eventBufferId: insertedEvent.id },
              'Responding to Stripe before reactor call completes',
            );
            resolve(new Response(null, { status: 200 }));
          }, 500); // Give the reactor call 500ms to complete before responding
        });

        const reactorPromise = fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/guardian-reactor`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_buffer_id: insertedEvent.id,
            }),
          },
        )
          .then(async (response) => {
            if (!response.ok) {
              const responseText = await response.text();
              logger.error(
                {
                  statusCode: response.status,
                  statusText: response.statusText,
                  response: responseText,
                  eventBufferId: insertedEvent.id,
                },
                'Guardian reactor call failed',
              );

              // Record the failure for retry
              await supabaseAdmin.from('failed_event_dispatch').insert({
                event_buffer_id: insertedEvent.id,
                endpoint: '/api/guardian-reactor',
                status_code: response.status,
                error_message: responseText,
                request_payload: { event_buffer_id: insertedEvent.id },
              });
            } else {
              logger.info({ eventBufferId: insertedEvent.id }, 'Guardian reactor call succeeded');
            }

            return new Response(null, { status: 200 });
          })
          .catch(async (err) => {
            logger.error(
              { err, eventBufferId: insertedEvent.id },
              'Guardian reactor call threw exception',
            );

            // Record the failure for retry
            await supabaseAdmin
              .from('failed_event_dispatch')
              .insert({
                event_buffer_id: insertedEvent.id,
                endpoint: '/api/guardian-reactor',
                error_message: err.message,
                request_payload: { event_buffer_id: insertedEvent.id },
              })
              .catch((insertErr) => {
                logger.error({ insertErr }, 'Failed to record reactor failure');
              });

            return new Response(null, { status: 200 });
          });

        // Race the reactor call against the timeout
        return Promise.race([reactorPromise, timeoutPromise]);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to process webhook');
    // Return 200 anyway to prevent Stripe retries - we've verified the signature
  }

  // Calculate total processing time
  const totalTime = performance.now() - startTime;
  logger.info(
    {
      verificationTime: Math.round(verificationTime),
      totalTime: Math.round(totalTime),
      eventId: event.id,
    },
    'Webhook processing complete',
  );

  // Return 200 OK quickly to Stripe
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
