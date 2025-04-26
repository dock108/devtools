// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateRulesEdge } from '../../lib/guardian/rules/edge.ts';
import { validateStripeEvent } from '../../lib/guardian/validation/edge.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RECENT_LOOKBACK_DAYS = parseInt(Deno.env.get('RECENT_LOOKBACK_DAYS') || '30', 10);

// Log environment configurations on cold start
console.log(`Guardian Reactor initialized`);
console.log(`Add to .env to override: RECENT_LOOKBACK_DAYS=${RECENT_LOOKBACK_DAYS}`);

interface ProcessEventRequest {
  event_buffer_id: string;
}

const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string,
  );
};

// Handle CORS preflight requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = performance.now();
  let eventBufferId: string | null = null;
  let eventPayload: any | null = null;

  try {
    // Parse request body
    const body = (await req.json()) as ProcessEventRequest;
    eventBufferId = body.event_buffer_id;

    // Validate required fields
    if (!eventBufferId) {
      // Return 400 immediately if event_buffer_id is missing
      return new Response(JSON.stringify({ error: 'Missing required field: event_buffer_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // Fetch the event from event_buffer
    const { data: event, error: eventError } = await supabase
      .from('event_buffer')
      .select('*')
      .eq('id', eventBufferId)
      .single();

    if (eventError || !event) {
      // Event not found, return 404. No need to DLQ if the source is gone.
      return new Response(
        JSON.stringify({
          error: `Event not found: ${eventError?.message || 'No event with this ID exists'}`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Store payload for potential DLQ insertion
    eventPayload = event.payload;

    // Extract Stripe event details from the payload
    const stripeEvent = event.payload;
    const stripeEventId = stripeEvent.id;
    const stripeAccountId = stripeEvent.account || 'acct_unknown';

    // Validate the Stripe event
    const validationResult = validateStripeEvent(stripeEvent);
    if (!validationResult.valid) {
      // This is a bad event, no point retrying. Return 400.
      return new Response(
        JSON.stringify({
          error: 'Event validation failed',
          details: validationResult.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Process the event in a transaction to ensure atomicity and idempotency
    const { data: txResult, error: txError } = await supabase.transaction(async (tx) => {
      // Check if the event has already been processed (idempotency guard)
      const { error: dupError } = await tx
        .from('processed_events')
        .insert({ stripe_event_id: stripeEventId })
        .select();

      // If we got a unique violation error, this event was already processed
      if (dupError?.code === '23505') {
        // unique_violation
        return { skipped: true };
      }

      // Re-throw other insertion errors to trigger rollback + DLQ
      if (dupError) {
        throw new Error(`Failed to mark event as processed: ${dupError.message}`);
      }

      // Evaluate rules
      let alerts = [];
      try {
        alerts = await evaluateRulesEdge(stripeEvent, tx); // Pass the transaction client
      } catch (ruleError) {
        throw new Error(`Rule evaluation failed: ${ruleError.message || String(ruleError)}`);
      }

      // Insert alerts (if any) with conflict handling
      if (alerts.length > 0) {
        const { error: alertError } = await tx.from('alerts').insert(
          alerts.map((alert) => ({
            alert_type: alert.type,
            severity: alert.severity,
            message: alert.message,
            stripe_payout_id: alert.payoutId,
            stripe_account_id: stripeAccountId,
            event_id: stripeEventId,
            resolved: false,
            // created_at defaults in DB
          })),
          { onConflict: 'stripe_account_id, alert_type, event_id' }, // Assuming this unique constraint exists
        );

        if (alertError) {
          throw new Error(`Failed to insert alerts: ${alertError.message}`);
        }
      }

      return {
        processed: true,
        alertCount: alerts.length,
      };
    });

    // If the transaction failed, this will be caught by the outer try/catch
    if (txError) {
      throw txError; // Rethrow to trigger DLQ insertion
    }

    // If the event was already processed
    if (txResult?.skipped) {
      return new Response(
        JSON.stringify({
          message: 'Event already processed',
          skipped: true,
        }),
        { status: 204, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Return success response
    const processingDuration = Math.round(performance.now() - startTime);
    return new Response(
      JSON.stringify({
        message: 'Event processed successfully',
        processing_duration_ms: processingDuration,
        alerts_created: txResult?.alertCount || 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error(`Guardian Reactor error: ${error.message}`, error.stack);

    // Attempt to insert into DLQ if we have the necessary info
    if (eventPayload && eventPayload.id && eventBufferId) {
      try {
        const supabase = getSupabaseClient();
        const { error: dlqError } = await supabase
          .from('failed_event_dispatch')
          .insert({
            event_buffer_id: eventBufferId,
            stripe_event_id: eventPayload.id,
            stripe_account_id: eventPayload.account,
            type: eventPayload.type,
            received_at: new Date().toISOString(), // Or use event creation time?
            payload: eventPayload,
            last_error: error.message || String(error),
          })
          .select();

        if (dlqError) {
          console.error(`Failed to insert into DLQ: ${dlqError.message}`);
          // If DLQ insert fails, return 500 to signal a critical problem
          return new Response(
            JSON.stringify({ error: `Server error & DLQ failure: ${dlqError.message}` }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      } catch (dlqInsertError) {
        console.error(`Exception during DLQ insertion: ${dlqInsertError.message}`);
        return new Response(
          JSON.stringify({ error: `Server error & DLQ exception: ${dlqInsertError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    } else {
      console.error('Cannot insert into DLQ: Missing event payload, ID, or buffer ID.');
      // Still return 500 if we couldn't DLQ
      return new Response(
        JSON.stringify({ error: `Server error, cannot DLQ: ${error.message || error}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // IMPORTANT: Return 204 No Content after successful DLQ insertion
    // This acknowledges receipt to the webhook source without implying success,
    // preventing infinite retries from the source (e.g., Stripe).
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders },
    });
  }
});
