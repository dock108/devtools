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

    // Check if the event has already been processed using stripe_event_id
    const { data: processedEvent } = await supabase
      .from('processed_events')
      .select('id')
      .eq('stripe_event_id', stripeEventId)
      .maybeSingle();

    if (processedEvent) {
      return new Response(
        JSON.stringify({
          message: 'Event already processed',
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate the Stripe event
    const validationResult = validateStripeEvent(stripeEvent);
    if (!validationResult.valid) {
      // Record the failure in processed_events
      const { data: failedProcessed } = await supabase
        .from('processed_events')
        .insert({
          stripe_event_id: stripeEventId,
          stripe_account_id: stripeAccountId,
          processed_at: new Date().toISOString(),
          process_duration_ms: Math.round(performance.now() - startTime),
          alerts_created: 0,
        })
        .select('id')
        .single();

      return new Response(
        JSON.stringify({
          error: 'Event validation failed',
          details: validationResult.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Evaluate rules
    let createdAlerts = [];
    try {
      const ruleResult = await evaluateRulesEdge(stripeEvent, supabase);
      createdAlerts = ruleResult.alerts || [];
    } catch (ruleError) {
      // Record the rule evaluation failure
      const { data: failedProcessed } = await supabase
        .from('processed_events')
        .insert({
          stripe_event_id: stripeEventId,
          stripe_account_id: stripeAccountId,
          processed_at: new Date().toISOString(),
          process_duration_ms: Math.round(performance.now() - startTime),
          alerts_created: 0,
        })
        .select('id')
        .single();

      return new Response(
        JSON.stringify({
          error: 'Rule evaluation failed',
          details: ruleError.message || String(ruleError),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Record successful processing
    const processingDuration = Math.round(performance.now() - startTime);
    const { data: processedRecord, error: processedError } = await supabase
      .from('processed_events')
      .insert({
        stripe_event_id: stripeEventId,
        stripe_account_id: stripeAccountId,
        processed_at: new Date().toISOString(),
        process_duration_ms: processingDuration,
        alerts_created: createdAlerts.length,
      })
      .select('id')
      .single();

    if (processedError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to record processed event',
          details: processedError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        message: 'Event processed successfully',
        processed_event_id: processedRecord.id,
        processing_duration_ms: processingDuration,
        alerts_created: createdAlerts.length,
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
