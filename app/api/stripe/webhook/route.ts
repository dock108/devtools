import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe'; // Assuming stripe instance is correctly initialized
import Stripe from 'stripe'; // Import Stripe for types
import { supabaseAdmin } from '@/lib/supabase-admin';
import { log, generateRequestId } from '@/lib/logger';
import { isGuardianSupportedEvent } from '@/lib/guardian/stripeEvents';
import { validateStripeEvent, isStrictValidationEnabled } from '@/lib/guardian/validateStripeEvent';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { processWebhookEvent } from '@/lib/guardian/webhookHandler';
import { buffer } from 'node:stream/consumers';

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
  const baseLogData: Record<string, any> = { req_id: reqId, service: 'webhook-handler' }; // Base data for logs

  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Incoming webhook request');

  if (req.method !== 'POST') {
    log.warn({ ...baseLogData, status: 405 }, 'Method not allowed');
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  const accountIdHeader = req.headers.get('stripe-account'); // Stripe Connect account ID
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch (err: any) {
    log.error({ ...baseLogData, err: err?.message, status: 400 }, 'Failed to read request body');
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event | null = null; // Use Stripe.Event type
  let verifiedAccountId: string | null = null;
  let status = 500; // Default to internal error
  let eventId: string | undefined;
  let eventType: string | undefined;

  try {
    if (!sig) {
      log.error({ ...baseLogData, status: 400 }, 'Missing Stripe signature header');
      status = 400;
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log.error(
        { ...baseLogData, status: 500 },
        'Missing STRIPE_WEBHOOK_SECRET environment variable',
      );
      throw new Error('Webhook secret not configured');
    }

    try {
      // Use the specific Stripe type
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret) as Stripe.Event;
      eventId = event.id;
      eventType = event.type;
    } catch (err: any) {
      log.error(
        { ...baseLogData, err: err?.message, status: 400 },
        'Webhook signature verification failed',
      );
      status = 400;
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const eventLogData = { ...baseLogData, stripe_event_id: eventId, event_type: eventType };

    if (!eventType || !isGuardianSupportedEvent(eventType)) {
      log.warn({ ...eventLogData, status: 200 }, 'Unsupported event type received, skipping.'); // Return 200 OK to Stripe
      status = 200;
      return NextResponse.json({ message: 'Unsupported event type' }, { status: 200 });
    }

    // Optional: Strict validation
    if (isStrictValidationEnabled()) {
      try {
        validateStripeEvent(event); // Pass the strongly-typed event
      } catch (err) {
        status = 400;
        if (err instanceof ZodError) {
          log.error(
            { ...eventLogData, zodErrors: err.errors, status: 400 },
            'Event validation failed',
          );
          // Return 200 to Stripe, but log error. Don't buffer invalid events.
          return NextResponse.json({ message: 'Event validation failed' }, { status: 200 });
        }
        // Check for specific error message if validateStripeEvent throws it
        if (err instanceof Error && err.message.includes('Unsupported event type')) {
          log.warn(
            { ...eventLogData, status: 200 },
            'Unsupported event type received (validation), skipping.',
          );
          return NextResponse.json({ message: 'Unsupported event type' }, { status: 200 });
        }
        // For unknown validation errors, log and potentially let it bubble up (or return 500)
        log.error({ ...eventLogData, err, status: 500 }, 'Unknown validation error');
        throw err; // Re-throw unknown errors for outer catch
      }
    }

    // Determine the responsible account ID
    verifiedAccountId = accountIdHeader ?? event.account ?? null;

    if (!verifiedAccountId) {
      log.error({ ...eventLogData, status: 400 }, 'Missing account ID in header or event');
      // Return 200 to Stripe, cannot process without account ID.
      return NextResponse.json({ message: 'Missing account ID' }, { status: 200 });
    }

    const finalLogData = { ...eventLogData, stripe_account_id: verifiedAccountId };
    log.info(
      { ...finalLogData, validation_enabled: isStrictValidationEnabled() },
      'Webhook signature and payload verified',
    );

    // Store the raw event in the buffer
    // Use generated types for insert payload
    const bufferData: TablesInsert<'event_buffer'> = {
      stripe_event_id: eventId, // eventId is string | undefined, checked above
      stripe_account_id: verifiedAccountId, // checked above
      type: eventType, // checked above
      payload: event.data as any, // Store original data part - needs careful typing or use Json
      received_at: new Date().toISOString(),
    };

    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('event_buffer')
      .upsert(bufferData, { onConflict: 'stripe_event_id' })
      .select('id') // Select the primary key (assuming it's 'id' and type number/bigint)
      .single<{ id: number }>(); // Specify return type

    if (insertError) {
      log.error(
        { ...finalLogData, db_error: insertError.message },
        'Failed to insert event into buffer',
      );
      // Acknowledge receipt to Stripe, but log the error internally
      status = 200; // Treat as success for Stripe
    } else if (insertedEvent?.id) {
      const eventBufferId = insertedEvent.id;
      log.info({ ...finalLogData, event_buffer_id: eventBufferId }, 'Event stored in buffer');

      // Async dispatch to reactor - Don't await, respond to Stripe quickly
      // Ensure Supabase URL and Service Role Key are defined
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        fetch(`${supabaseUrl}/functions/v1/guardian-reactor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
            // apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Anon key likely not needed for service role calls
          },
          body: JSON.stringify({ event_buffer_id: eventBufferId }),
        })
          .then(async (response) => {
            if (!response.ok && response.status !== 204) {
              // Allow 204 (already processed)
              const responseText = await response.text();
              log.error(
                {
                  ...finalLogData,
                  event_buffer_id: eventBufferId,
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
                  event_buffer_id: eventBufferId,
                  reactor_status: response.status,
                },
                'Guardian reactor async dispatch initiated',
              );
            }
          })
          .catch((err: any) => {
            log.error(
              { ...finalLogData, event_buffer_id: eventBufferId, err: err?.message },
              'Guardian reactor async dispatch exception',
            );
            // DLQ insertion happens within the reactor now
          });
      } else {
        log.error(
          { ...finalLogData, event_buffer_id: eventBufferId },
          'Cannot trigger reactor: Missing Supabase URL or Service Role Key',
        );
      }
      status = 200; // Success from webhook perspective
    } else {
      log.error({ ...finalLogData }, 'Failed to get inserted event buffer ID after upsert');
      status = 200; // Still success for Stripe
    }
  } catch (err: any) {
    status = status >= 400 ? status : 500; // Keep 4xx if already set, otherwise 500
    log.error(
      {
        ...baseLogData,
        stripe_event_id: eventId,
        stripe_account_id: verifiedAccountId,
        err: err?.message,
        stack: err?.stack, // Log stack for internal errors
        status,
      },
      'Unhandled webhook processing error',
    );
    // Return generic 500 for internal errors
    const errorResponse = { error: 'Internal Server Error' };
    return NextResponse.json(errorResponse, { status: 500 });
  }

  // Calculate total processing time
  const durationMs = Math.round(performance.now() - startTime);
  log.info(
    {
      ...baseLogData,
      stripe_event_id: eventId,
      stripe_account_id: verifiedAccountId,
      duration_ms: durationMs,
      status,
    },
    'Webhook processing complete',
  );

  // Return 200 OK quickly to Stripe
  return NextResponse.json({ received: true }, { status });
}

// Note: Removed GET handler for /api/metrics as it needs separate implementation
