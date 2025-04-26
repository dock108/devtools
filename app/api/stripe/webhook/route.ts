import { NextRequest, NextResponse } from 'next/server';
import { stripe, Stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { log, generateRequestId } from '@/lib/logger';
import { isGuardianSupportedEvent } from '@/lib/guardian/stripeEvents';
import { validateStripeEvent, isStrictValidationEnabled } from '@/lib/guardian/validateStripeEvent';
import { ZodError } from 'zod';

export const runtime = 'edge';
export const maxDuration = 5; // 5 seconds maximum for the webhook handler

// Print environment variable hint on startup using the logger
if (isStrictValidationEnabled()) {
  log.info('Stripe event validation is ENABLED (default)');
  log.info('Add to .env if you need to disable validation locally: STRICT_STRIPE_VALIDATION=false');
} else {
  log.warn('Stripe event validation is DISABLED - This should only be used for development');
}

/**
 * Handles Stripe webhook events
 * - Verifies signature
 * - Identifies source account
 * - Checks if event type is supported
 * - Validates event shape against schema
 * - Stores raw event payload in event_buffer
 * - Forwards to guardian-reactor
 * - Returns 200 OK quickly
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();
  const reqId = generateRequestId();
  const baseLogData = { req_id: reqId, service: 'webhook-handler' }; // Base data for logs

  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Incoming webhook request');

  if (req.method !== 'POST') {
    log.warn({ ...baseLogData, status: 405 }, 'Method not allowed');
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  const accountIdHeader = req.headers.get('stripe-account'); // Renamed for clarity
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch (err: any) {
    log.error({ ...baseLogData, err: err.message, status: 400 }, 'Failed to read request body');
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event | null = null; // Initialize as null
  let verifiedAccountId: string | null = null; // Initialize as null
  let status = 500; // Default to internal error
  let eventTypeLabel = 'unknown'; // Default label for metrics

  try {
    if (!sig) {
      log.error({ ...baseLogData, status: 400 }, 'Missing Stripe signature header');
      status = 400;
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
    }

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
      eventTypeLabel = event.type || 'unknown'; // Set label once event is parsed
    } catch (err: any) {
      log.error(
        { ...baseLogData, err: err.message, status: 400 },
        'Webhook signature verification failed',
      );
      status = 400;
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.type;
    eventTypeLabel = eventType; // Update label
    const eventLogData = { ...baseLogData, stripe_event_id: eventId, event_type: eventType };

    if (!isGuardianSupportedEvent(eventType)) {
      log.warn({ ...eventLogData, status: 400 }, 'Unsupported event type received');
      status = 400;
      return NextResponse.json({ error: 'unsupported_event_type' }, { status: 400 });
    }

    if (isStrictValidationEnabled()) {
      try {
        validateStripeEvent(event);
      } catch (err) {
        status = 400;
        if (err instanceof ZodError) {
          log.error(
            { ...eventLogData, zodErrors: err.errors, status: 400 },
            'Event validation failed',
          );
          return NextResponse.json({ error: 'unsupported_event_shape' }, { status: 400 });
        }
        if (err instanceof Error && err.message.includes('Unsupported event type')) {
          log.warn(
            { ...eventLogData, status: 400 },
            'Unsupported event type received (validation)',
          );
          return NextResponse.json({ error: 'unsupported_event_type' }, { status: 400 });
        }
        log.error({ ...eventLogData, err, status: 500 }, 'Unknown validation error');
        throw err; // Re-throw unknown errors for outer catch
      }
    }

    verifiedAccountId = accountIdHeader || event.account || null;

    if (!verifiedAccountId) {
      log.error({ ...eventLogData, status: 400 }, 'Missing account ID in header or event');
      status = 400;
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }

    const finalLogData = { ...eventLogData, stripe_account_id: verifiedAccountId };
    log.info(
      { ...finalLogData, validation_enabled: isStrictValidationEnabled() },
      'Webhook signature and payload verified',
    );

    // Record verification time
    const verificationTime = performance.now() - startTime;

    // Store the raw event in the buffer
    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('event_buffer')
      .upsert(
        {
          stripe_event_id: eventId,
          stripe_account_id: verifiedAccountId,
          type: eventType,
          payload: event.data, // Store original data part
          received_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_event_id' },
      )
      .select('id')
      .single();

    if (insertError) {
      log.error(
        { ...finalLogData, err: insertError.message },
        'Failed to insert event into buffer',
      );
      // Acknowledge receipt to Stripe, but log the error internally
      status = 200; // Treat as success for Stripe
    } else if (insertedEvent?.id) {
      log.info({ ...finalLogData, event_buffer_id: insertedEvent.id }, 'Event stored in buffer');

      // Async dispatch to reactor - Don't await, respond to Stripe quickly
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/guardian-reactor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Pass anon key if needed by function
        },
        body: JSON.stringify({ event_buffer_id: insertedEvent.id }),
      })
        .then(async (response) => {
          if (!response.ok && response.status !== 204) {
            // Allow 204 (already processed)
            const responseText = await response.text();
            log.error(
              {
                ...finalLogData,
                event_buffer_id: insertedEvent.id,
                reactor_status: response.status,
                reactor_response: responseText,
              },
              'Guardian reactor async dispatch failed',
            );
            // DLQ insertion happens within the reactor now
          } else {
            log.info(
              {
                ...finalLogData,
                event_buffer_id: insertedEvent.id,
                reactor_status: response.status,
              },
              'Guardian reactor async dispatch initiated',
            );
          }
        })
        .catch((err: any) => {
          log.error(
            { ...finalLogData, event_buffer_id: insertedEvent.id, err: err.message },
            'Guardian reactor async dispatch exception',
          );
          // DLQ insertion happens within the reactor now
        });

      status = 200; // Success from webhook perspective
    } else {
      log.error({ ...finalLogData }, 'Failed to get inserted event buffer ID after upsert');
      status = 200; // Still success for Stripe
    }
  } catch (err: any) {
    status = status === 500 ? 500 : status; // Keep 400 if already set
    log.error(
      {
        ...baseLogData,
        stripe_event_id: event?.id,
        stripe_account_id: verifiedAccountId,
        err: err.message,
        status,
      },
      'Unhandled webhook processing error',
    );
    // Return specific error if status is 400, otherwise generic 500
    const errorResponse =
      status === 400 ? { error: err.message || 'Bad Request' } : { error: 'Internal Server Error' };
    return NextResponse.json(errorResponse, { status });
  }

  // Calculate total processing time and record histogram
  const durationMs = Math.round(performance.now() - startTime);
  log.info(
    {
      ...baseLogData,
      stripe_event_id: event?.id,
      stripe_account_id: verifiedAccountId,
      duration_ms: durationMs,
      status,
    },
    'Webhook processing complete',
  );

  // Return 200 OK quickly to Stripe
  return NextResponse.json({ received: true }, { status });
}

// Expose metrics endpoint for Next.js app
export async function GET(req: NextRequest) {
  if (req.nextUrl.pathname === '/api/metrics') {
    try {
      // Optional: Add auth check here if needed for the Next.js endpoint
      // const authToken = req.headers.get('authorization')?.split(' ')[1];
      // if (authToken !== process.env.METRICS_AUTH_TOKEN) {
      //     return new Response('Unauthorized', { status: 401 });
      // }

      // This needs to be adjusted or removed as registry is no longer imported here
      // For now, returning an empty response or an error
      // const metrics = await registry.metrics();
      // return new Response(metrics, {
      //   headers: { 'Content-Type': registry.contentType },
      // });
      log.warn(
        { service: 'metrics-api', path: '/api/stripe/webhook' },
        'Metrics endpoint accessed but metrics disabled for Edge route.',
      );
      return new Response('Metrics not available on this path', { status: 404 });
    } catch (error: any) {
      log.error({ service: 'metrics-api', err: error.message }, 'Failed to generate metrics');
      return new Response('Internal Server Error', { status: 500 });
    }
  }
  // Fallback for other GET requests to /api/stripe/webhook
  return NextResponse.json({ status: 'ok' });
}
