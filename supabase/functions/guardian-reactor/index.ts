// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateRulesEdge } from '../../lib/guardian/rules/edge.ts';
import { validateStripeEvent } from '../../lib/guardian/validation/edge.ts';
import { log, generateRequestId } from '../../lib/logger.ts'; // Adjust path if needed
import { getRuleConfig } from '../../lib/guardian/getRuleConfig.ts'; // Import config loader
import { Database, Json, Tables, TablesInsert } from '../../types/supabase.ts'; // Import generated types
import { AlertType, Severity } from '../../lib/guardian/constants.ts'; // Import shared enums
import Stripe from 'https://esm.sh/stripe@12.17.0?target=deno&deno-std=0.132.0'; // Import Stripe types if needed

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RECENT_LOOKBACK_DAYS = parseInt(Deno.env.get('RECENT_LOOKBACK_DAYS') ?? '30', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
  );
  // Consider throwing an error to prevent startup
}

// Log environment configurations on cold start
console.log(`Guardian Reactor initialized`);
console.log(`Optional env: RECENT_LOOKBACK_DAYS=${RECENT_LOOKBACK_DAYS}`);

interface ProcessEventRequest {
  event_buffer_id: number; // Assuming event_buffer.id is bigint -> number
}

const getSupabaseClient = (): SupabaseClient => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// Handle CORS preflight requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  const reqId = generateRequestId();
  const baseLogData: Record<string, any> = { req_id: reqId, service: 'guardian-reactor' }; // Use Record for flexibility
  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Incoming reactor request');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = performance.now();
  let eventBufferId: number | null = null;
  let eventPayload: Json | null = null; // Use Json type from Supabase types
  let stripeAccountId: string | null = null;
  let stripeEventId: string | null = null;
  let eventType: string | null = null;
  let status = 500; // Default status
  let metricOutcome = 'critical_error'; // Default outcome for metrics
  let rulesEvalMs: number | null = null;
  let ruleConfig: Record<string, any> | null = null; // Keep as Record for now

  try {
    // Parse request body
    let body: ProcessEventRequest;
    try {
      body = await req.json();
      // Add basic validation for the incoming request structure
      if (typeof body.event_buffer_id !== 'number') {
        throw new Error('Invalid or missing event_buffer_id (must be number)');
      }
    } catch (parseError: any) {
      status = 400;
      log.error(
        { ...baseLogData, err: parseError?.message, status },
        'Failed to parse request body',
      );
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parseError?.message }),
        {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    eventBufferId = body.event_buffer_id;
    const eventLogData = { ...baseLogData, event_buffer_id: eventBufferId };

    const supabase = getSupabaseClient();

    // Fetch the event from event_buffer
    // Use generated types for better type safety
    const { data: event, error: eventError } = await supabase
      .from('event_buffer')
      .select('*, stripe_event_id, stripe_account_id, type, payload') // Select needed fields explicitly
      .eq('id', eventBufferId)
      .returns<Tables<'event_buffer'> | null>() // Use generated type
      .maybeSingle(); // Use maybeSingle for potentially null result

    if (eventError || !event) {
      status = 404;
      const errorMsg = eventError?.message ?? 'Event not found in buffer';
      log.error({ ...eventLogData, db_error: errorMsg, status }, 'Event not found in buffer');
      return new Response(JSON.stringify({ error: `Event not found: ${errorMsg}` }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store details for logging & fetch config
    eventPayload = event.payload;
    stripeEventId = event.stripe_event_id;
    stripeAccountId = event.stripe_account_id;
    eventType = event.type;

    // Validate essential data fetched from the buffer
    if (!eventPayload || !stripeEventId || !stripeAccountId || !eventType) {
      status = 400;
      log.error({ ...eventLogData, status }, 'Missing critical event data in event_buffer row');
      // Potentially move to DLQ here as well, as it's bad data
      return new Response(JSON.stringify({ error: 'Incomplete event data in buffer' }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalLogData = {
      ...eventLogData,
      stripe_event_id: stripeEventId,
      stripe_account_id: stripeAccountId,
      event_type: eventType,
    };

    // --- Fetch Rule Config BEFORE Transaction ---
    try {
      // Ensure stripeAccountId is not null before passing
      ruleConfig = await getRuleConfig(stripeAccountId);
      if (!ruleConfig) {
        log.error(
          { ...finalLogData },
          'Critical: Failed to retrieve any rule configuration (default or custom).',
        );
        throw new Error('Failed to retrieve rule configuration.');
      }
      log.debug({ ...finalLogData }, 'Successfully fetched rule configuration.');
    } catch (configError: any) {
      log.error(
        { ...finalLogData, err: configError?.message },
        'Error fetching rule configuration.',
      );
      throw configError;
    }

    // --- Transactional Processing --- //
    // Use the specific Supabase client type within the transaction for better type inference
    const { data: txResult, error: txError } = await supabase.rpc('execute_sql_as_transaction', {
      // Wrap the transaction logic in an SQL string or use a helper if Supabase Deno lib supports tx objects directly
      // This part needs adjustment based on how Supabase Deno handles transactions.
      // Placeholder: Assuming direct transaction object support for now.
      sql: `
        -- Placeholder: Transaction logic needs to be adapted for Deno Supabase
        -- SELECT 'Simulating transaction success' as result;
      `,
      // --- Alternate if Supabase Deno supports transaction objects ---
      // callback: async (tx: SupabaseClient<Database>) => { // Use typed client
    });

    // --- TODO: Refactor Transaction Logic --- //
    // The following logic needs to be adapted to work within the Supabase Deno transaction model
    // (e.g., using RPC calls for each step or structuring differently if tx object is available)

    /* 
    // Example logic assuming a transaction object `tx` is available:
    if (!stripeEventId) throw new Error('stripeEventId became null unexpectedly'); // Guard

    // Idempotency check
    const { error: dupError } = await tx
      .from('processed_events')
      .insert({ stripe_event_id: stripeEventId })
      .select('stripe_event_id') // Select minimal data
      .maybeSingle(); // Check if insert happened or conflict occurred

    if (dupError?.code === '23505') { // PostgreSQL unique violation
      log.info({ ...finalLogData }, 'Event already processed (idempotency check)');
      metricOutcome = 'skipped';
      return { skipped: true, alertCount: 0 }; // Ensure alertCount is defined
    }
    if (dupError) {
      throw new Error(`Failed idempotency check: ${dupError.message}`);
    }

    // Validate the event payload (using Zod or similar, integrate here)
    // const validationResult = validateStripeEvent(eventPayload);
    // if (!validationResult.success) {
    //   log.warn({ ...finalLogData, validation_error: validationResult.error }, 'Stripe event validation failed');
    //   metricOutcome = 'invalid_event';
    //   // Decide: skip or DLQ?
    //   return { skipped: true, invalid: true, alertCount: 0 }; 
    // }
    // const validatedEvent = validationResult.data; // Use validated data

    // Evaluate rules (pass validated event and config)
    let alerts: TablesInsert<'alerts'>[] = []; // Use generated insert type
    try {
      const ruleStart = performance.now();
      // Ensure ruleConfig is not null
      if (!ruleConfig) throw new Error ('Rule config is null'); 
      // Pass validatedEvent instead of eventPayload if validation is added
      alerts = await evaluateRulesEdge(eventPayload, tx, ruleConfig);
      rulesEvalMs = Math.round(performance.now() - ruleStart);
      log.info({ ...finalLogData, rules_eval_ms: rulesEvalMs, alert_count: alerts.length }, 'Rules evaluated');
    } catch (ruleError: any) {
      if (rulesEvalMs !== null) {
        log.info({ ...finalLogData, rules_eval_ms: rulesEvalMs, error: ruleError?.message }, 'Rule evaluation timing before error');
      }
      throw new Error(`Rule evaluation failed: ${ruleError?.message ?? String(ruleError)}`);
    }

    // Insert alerts
    if (alerts.length > 0) {
      // Ensure stripeAccountId and stripeEventId are valid before mapping
      if (!stripeAccountId || !stripeEventId) throw new Error('Missing account/event ID for alert insertion');
      
      const alertsToInsert = alerts.map(alert => ({
        ...alert, // Spread the result from evaluateRulesEdge
        stripe_account_id: stripeAccountId!, // Use non-null assertion after check
        event_id: stripeEventId!, // Use non-null assertion after check
        resolved: false,
        // Map fields correctly based on evaluateRulesEdge output and TablesInsert<'alerts'>
        alert_type: alert.alert_type as AlertType, // Cast if necessary
        severity: alert.severity as Severity, // Cast if necessary
        message: alert.message, // Assuming message is string
        stripe_payout_id: alert.stripe_payout_id, // Assuming optional payoutId
      }));

      const { error: alertError } = await tx
        .from('alerts')
        .insert(alertsToInsert)
        // .onConflict('stripe_account_id, alert_type, event_id') // Define conflict target if needed
        // .ignore(); // Or handle conflict

      if (alertError) {
        throw new Error(`Failed to insert alerts: ${alertError.message}`);
      }
      log.info({ ...finalLogData, alert_count: alerts.length }, 'Alerts inserted');
    }

    return {
      processed: true,
      alertCount: alerts.length,
    };
    */
    // --- End of TODO: Refactor Transaction Logic --- //

    // --- Temporary response until transaction logic is refactored --- //
    if (txError) {
      metricOutcome = 'dlq_error';
      throw txError;
    }
    log.warn({ ...finalLogData }, 'Transaction logic needs refactoring for Supabase Deno client.');
    const durationMsTemp = Math.round(performance.now() - startTime);
    metricOutcome = 'success'; // Assume success for now
    status = 200;
    return new Response(
      JSON.stringify({
        message: 'Processed (logic pending refactor)',
        duration_ms: durationMsTemp,
      }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
    // --- End Temporary Response --- //

    /* // Original success/skip logic (keep for reference during refactor)
    if (txResult?.skipped) {
      status = 204;
      const durationMs = Math.round(performance.now() - startTime);
      log.info({ ...finalLogData, duration_ms: durationMs, status, metric_event: 'reactor_events_total', metric_outcome: metricOutcome }, 'Event processing skipped (already processed)');
      return new Response(null, { status, headers: { ...corsHeaders } });
    }

    // Success
    metricOutcome = 'success';
    status = 200;
    const durationMs = Math.round(performance.now() - startTime);
    const responsePayload = {
        message: 'Event processed successfully',
        processing_duration_ms: durationMs,
        alerts_created: txResult?.alertCount ?? 0, // Use nullish coalescing
    };
    const successMetrics: Record<string, any> = { duration_ms: durationMs, alerts_created: responsePayload.alerts_created, status, metric_event: 'reactor_events_total', metric_outcome: metricOutcome };
    if (rulesEvalMs !== null) {
        successMetrics.metric_hist_reactor_eval_ms = rulesEvalMs;
    }
    log.info({ ...finalLogData, ...successMetrics }, 'Event processed successfully');
    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    */
  } catch (error: any) {
    status = status >= 400 ? status : 500; // Keep 4xx errors if already set
    const errorMsg = error?.message ?? String(error);
    // Ensure critical IDs are available for logging/DLQ
    const finalLogData = {
      ...baseLogData,
      event_buffer_id: eventBufferId,
      stripe_event_id: stripeEventId,
      stripe_account_id: stripeAccountId,
      event_type: eventType,
    };
    log.error({ ...finalLogData, err: errorMsg, status }, `Guardian Reactor error: ${errorMsg}`);

    // Attempt to insert into DLQ
    if (eventPayload && stripeEventId && eventBufferId) {
      metricOutcome = 'dlq_error'; // Error led to DLQ attempt
      try {
        const supabase = getSupabaseClient();
        const dlqData: TablesInsert<'failed_event_dispatch'> = {
          event_buffer_id: eventBufferId, // Ensure type matches (number)
          stripe_event_id: stripeEventId,
          stripe_account_id: stripeAccountId ?? 'unknown', // Handle potential null
          type: eventType ?? 'unknown', // Handle potential null
          received_at: new Date().toISOString(), // Consider event.created_at if available
          payload: eventPayload, // Should be Json type
          last_error: errorMsg,
        };
        const { error: dlqError } = await supabase
          .from('failed_event_dispatch')
          .insert(dlqData)
          .select('id') // Select minimal column
          .maybeSingle();

        if (dlqError) {
          metricOutcome = 'critical_error'; // DLQ insert failed
          log.error(
            {
              ...finalLogData,
              dlq_error: dlqError.message,
              metric_event: 'reactor_events_total',
              metric_outcome: metricOutcome,
            },
            'Failed to insert into DLQ',
          );
          // Return original error status, not necessarily 500
          return new Response(
            JSON.stringify({ error: `Server error & DLQ failure: ${dlqError.message}` }),
            {
              status: 500, // Force 500 on DLQ failure
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        } else {
          log.info(
            {
              ...finalLogData,
              metric_event: 'reactor_events_total',
              metric_outcome: metricOutcome,
            },
            'Event inserted into DLQ after error',
          );
          // Return the original error status that led to the DLQ
          return new Response(
            JSON.stringify({ error: `Event failed processing and sent to DLQ: ${errorMsg}` }),
            {
              status: status, // Return original status (e.g., 400 or 500)
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      } catch (dlqCatchError: any) {
        metricOutcome = 'critical_error';
        log.fatal(
          { ...finalLogData, err: dlqCatchError?.message },
          'CRITICAL: Unhandled exception during DLQ insertion',
        );
        // Return 500 on unexpected DLQ error
        return new Response(
          JSON.stringify({ error: 'Critical server error during DLQ processing' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    } else {
      // If essential data for DLQ is missing, return a generic server error
      metricOutcome = 'critical_error';
      log.error(
        { ...finalLogData, metric_event: 'reactor_events_total', metric_outcome: metricOutcome },
        'Cannot insert into DLQ due to missing event data',
      );
      return new Response(JSON.stringify({ error: `Server error: ${errorMsg}` }), {
        status: status, // Return original status
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});
