// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateRulesEdge } from '../../lib/guardian/rules/edge.ts';
import { validateStripeEvent } from '../../lib/guardian/validation/edge.ts';
import { log, generateRequestId } from '../../lib/logger.ts'; // Adjust path if needed
import { getRuleConfig } from '../../lib/guardian/getRuleConfig.ts'; // Import config loader

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
  const reqId = generateRequestId();
  const baseLogData = { req_id: reqId, service: 'guardian-reactor' };
  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Incoming reactor request');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = performance.now();
  let eventBufferId: string | null = null;
  let eventPayload: any | null = null;
  let stripeAccountId: string | null = null;
  let stripeEventId: string | null = null;
  let status = 500; // Default status
  let metricOutcome = 'critical_error'; // Default outcome for metrics
  let rulesEvalMs: number | null = null;
  let ruleConfig: Record<string, any> | null = null; // Variable for config

  try {
    // Parse request body
    let body: ProcessEventRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      status = 400;
      log.error({ ...baseLogData, err: parseError.message, status }, 'Failed to parse request body');
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    eventBufferId = body.event_buffer_id;
    const eventLogData = { ...baseLogData, event_buffer_id: eventBufferId };

    // Validate required fields
    if (!eventBufferId) {
      status = 400;
      log.error({ ...eventLogData, status }, 'Missing required field: event_buffer_id');
      return new Response(JSON.stringify({ error: 'Missing required field: event_buffer_id' }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // Fetch the event from event_buffer
    const { data: event, error: eventError } = await supabase
      .from('event_buffer')
      .select('*, payload->>'id' as stripe_event_id, payload->>'account' as stripe_account_id') // Select IDs directly
      .eq('id', eventBufferId)
      .single();

    if (eventError || !event) {
      status = 404;
      const errorMsg = eventError?.message || 'No event with this ID exists';
      log.error({ ...eventLogData, db_error: errorMsg, status }, 'Event not found in buffer');
      return new Response(JSON.stringify({ error: `Event not found: ${errorMsg}` }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store details for logging & fetch config
    eventPayload = event.payload;
    stripeEventId = event.stripe_event_id;
    stripeAccountId = event.stripe_account_id || 'acct_unknown';
    const finalLogData = { ...eventLogData, stripe_event_id: stripeEventId, stripe_account_id: stripeAccountId };

    // --- Fetch Rule Config BEFORE Transaction ---
    try {
        ruleConfig = await getRuleConfig(stripeAccountId);
        if (!ruleConfig) {
            log.error({ ...finalLogData }, 'Critical: Failed to retrieve any rule configuration (default or custom).');
            // Decide how to handle - fail hard?
            throw new Error('Failed to retrieve rule configuration.');
        }
        log.debug({ ...finalLogData }, 'Successfully fetched rule configuration.');
    } catch (configError) {
        log.error({ ...finalLogData, err: configError.message }, 'Error fetching rule configuration.');
        // Decide how to handle - fail hard?
        throw configError;
    }

    // Process the event in a transaction
    const { data: txResult, error: txError } = await supabase.transaction(async (tx) => {
      // Idempotency check
      const { error: dupError } = await tx
        .from('processed_events')
        .insert({ stripe_event_id: stripeEventId })
        .select();

      if (dupError?.code === '23505') {
        log.info({ ...finalLogData }, 'Event already processed (idempotency check)');
        metricOutcome = 'skipped'; // Set outcome for skipped event
        return { skipped: true };
      }
      if (dupError) {
        throw new Error(`Failed to mark event as processed: ${dupError.message}`);
      }

      // Evaluate rules (using tx client and pre-fetched config)
      let alerts = [];
      try {
        const ruleStart = performance.now();
        alerts = await evaluateRulesEdge(eventPayload, tx, ruleConfig);
        rulesEvalMs = Math.round(performance.now() - ruleStart);
        log.info({ ...finalLogData, rules_eval_ms: rulesEvalMs, alert_count: alerts.length }, 'Rules evaluated');
      } catch (ruleError) {
        // Log rule evaluation time even on error if measured
        if (rulesEvalMs !== null) {
            log.info({ ...finalLogData, rules_eval_ms: rulesEvalMs, error: ruleError.message }, 'Rule evaluation timing before error');
        }
        throw new Error(`Rule evaluation failed: ${ruleError.message || String(ruleError)}`);
      }

      // Insert alerts
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
          })),
          { onConflict: 'stripe_account_id, alert_type, event_id' },
        );
        if (alertError) {
          throw new Error(`Failed to insert alerts: ${alertError.message}`);
        }
        log.info({ ...finalLogData, alert_count: alerts.length }, 'Alerts inserted');
      }

      return {
        processed: true,
        alertCount: alerts.length,
      };
    });

    if (txError) {
       metricOutcome = 'dlq_error'; // Assume transaction errors lead to DLQ
      throw txError; // Rethrow to trigger DLQ insertion
    }

    if (txResult?.skipped) {
      status = 204;
      const durationMs = Math.round(performance.now() - startTime);
      // Log metric data for skipped event
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
        alerts_created: txResult?.alertCount || 0,
    };
    // Log metric data for successful event, including rule eval time if available
    const successMetrics = { duration_ms: durationMs, alerts_created: responsePayload.alerts_created, status, metric_event: 'reactor_events_total', metric_outcome: metricOutcome };
    if (rulesEvalMs !== null) {
        successMetrics.metric_hist_reactor_eval_ms = rulesEvalMs;
    }
    log.info({ ...finalLogData, ...successMetrics }, 'Event processed successfully');
    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    status = status !== 500 ? status : 500;
    const errorMsg = error.message || String(error);
    // metricOutcome should be set before throwing or defaults to critical_error
    const errorLogData = { ...baseLogData, event_buffer_id: eventBufferId, stripe_event_id: stripeEventId, stripe_account_id: stripeAccountId, err: errorMsg, status };
    log.error({ ...errorLogData }, `Guardian Reactor error: ${errorMsg}`);

    // Attempt to insert into DLQ
    if (eventPayload && stripeEventId && eventBufferId) {
      metricOutcome = 'dlq_error'; // Error led to DLQ attempt
      try {
        const supabase = getSupabaseClient();
        const { error: dlqError } = await supabase
          .from('failed_event_dispatch')
          .insert({
            event_buffer_id: eventBufferId,
            stripe_event_id: stripeEventId,
            stripe_account_id: stripeAccountId,
            type: eventPayload.type,
            received_at: new Date().toISOString(), // Or use event creation time?
            payload: eventPayload,
            last_error: errorMsg,
          })
          .select(); // Changed from .select() to avoid returning data

        if (dlqError) {
            metricOutcome = 'critical_error'; // DLQ insert failed
            log.error({ ...errorLogData, dlq_error: dlqError.message, metric_event: 'reactor_events_total', metric_outcome: metricOutcome }, 'Failed to insert into DLQ');
            status = 500;
            return new Response(JSON.stringify({ error: `Server error & DLQ failure: ${dlqError.message}` }), {
              status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } else {
             // Log metric data for DLQ success
             log.info({ ...errorLogData, metric_event: 'reactor_events_total', metric_outcome: metricOutcome }, 'Event inserted into DLQ after error');
             status = 204;
             return new Response(null, { status, headers: { ...corsHeaders } });
        }

      } catch (dlqInsertError) {
         metricOutcome = 'critical_error'; // DLQ insert exception
         log.error({ ...errorLogData, dlq_exception: dlqInsertError.message, metric_event: 'reactor_events_total', metric_outcome: metricOutcome }, `Exception during DLQ insertion`);
         status = 500;
         return new Response(JSON.stringify({ error: `Server error & DLQ exception: ${dlqInsertError.message}` }), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
        // metricOutcome remains 'critical_error'
        log.error({ ...errorLogData, metric_event: 'reactor_events_total', metric_outcome: metricOutcome }, "Cannot insert into DLQ: Missing event payload, ID, or buffer ID.");
        status = 500;
        return new Response(JSON.stringify({ error: `Server error, cannot DLQ: ${errorMsg}` }), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  }
});
