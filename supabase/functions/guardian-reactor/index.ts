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
  try {
    // Parse request body
    const body = (await req.json()) as ProcessEventRequest;

    // Validate required fields
    if (!body.event_buffer_id) {
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
      .eq('id', body.event_buffer_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({
          error: `Event not found: ${eventError?.message || 'No event with this ID exists'}`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Extract Stripe event details from the payload
    const stripeEvent = event.payload;
    const stripeEventId = stripeEvent.id;
    const stripeAccountId = stripeEvent.account || 'acct_unknown';

    // Validate the Stripe event
    const validationResult = validateStripeEvent(stripeEvent);
    if (!validationResult.valid) {
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

      // Evaluate rules
      let alerts = [];
      try {
        alerts = await evaluateRulesEdge(stripeEvent, supabase);
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
            created_at: new Date().toISOString(),
          })),
          { onConflict: 'stripe_account_id, alert_type, event_id' },
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

    if (txError) {
      return new Response(
        JSON.stringify({
          error: `Transaction failed: ${txError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
    // Handle server errors
    return new Response(JSON.stringify({ error: `Server error: ${error.message || error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
