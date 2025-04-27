// @ts-expect-error: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import * as Sentry from 'https://esm.sh/@sentry/node@7.114.0'; // Import Sentry Node SDK
import { ProfilingIntegration } from 'https://esm.sh/@sentry/profiling-node@7.114.0'; // Import Profiling Integration
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateRulesEdge } from '../../lib/guardian/rules/edge.ts';
import { validateStripeEvent } from '../../lib/guardian/validation/edge.ts';
import { log, generateRequestId } from '../../lib/logger.ts'; // Adjust path if needed
import { getRuleConfig } from '../../lib/guardian/getRuleConfig.ts'; // Import config loader
import { Database, Json, Tables, TablesInsert } from '../../types/supabase.ts'; // Import generated types
import { AlertType, Severity } from '../../lib/guardian/constants.ts'; // Import shared enums
import Stripe from 'https://esm.sh/stripe@12.17.0?target=deno&deno-std=0.132.0'; // Import Stripe types if needed
import {
  alertsTotal,
  webhookEventDurationSeconds,
  reactorEventsTotal,
} from '../../lib/metrics/registry.ts'; // Import metrics

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

// --- Sentry Initialization ---
const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      // Add ProfilingIntegration for performance monitoring
      new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: Deno.env.get('NODE_ENV') === 'production' ? 0.01 : 0.1,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: Deno.env.get('NODE_ENV') === 'production' ? 0.01 : 0.1,
    environment: Deno.env.get('NODE_ENV') || 'development',
    // release: Deno.env.get('VERCEL_GIT_COMMIT_SHA'), // Example if running on Vercel
  });
  console.log('[Sentry] Guardian Reactor SDK initialized');
  // Optional: Capture startup message
  // Sentry.captureMessage('Guardian Reactor started', 'info');
} else {
  console.log('[Sentry] Guardian Reactor SDK not initialized (SENTRY_DSN not set)');
}
// --- End Sentry Initialization ---

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
  (req as any).req_id = reqId;
  const baseLogData = { req_id: reqId, service: 'guardian-reactor' };
  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Incoming reactor request');

  const startTime = performance.now(); // Start timer for duration metric
  let metricOutcome = 'critical_error'; // Default outcome
  let status = 500;
  // Declare variables needed in the final block
  let eventBufferId: number | null = null;
  let stripeEventId: string | null = null;
  let stripeAccountId: string | null = null;
  let eventType: string | null = null;
  let finalLogData: Record<string, any> = baseLogData; // Initialize finalLogData

  const transaction = Sentry.startTransaction({
    op: 'guardian-reactor',
    name: 'Process Webhook Event',
  });
  Sentry.getCurrentScope().setSpan(transaction);

  // Use a function to ensure metrics are observed even if errors occur early
  const observeMetricsAndRespond = async (responsePromise: Promise<Response>) => {
    try {
      const response = await responsePromise;
      const durationSeconds = (performance.now() - startTime) / 1000;
      webhookEventDurationSeconds.observe({ outcome: metricOutcome }, durationSeconds);
      reactorEventsTotal.inc({ outcome: metricOutcome });
      log.debug(
        { ...finalLogData, duration_ms: durationSeconds * 1000, metric_outcome: metricOutcome },
        'Observed metrics for reactor event',
      );
      transaction?.setStatus(
        metricOutcome === 'success' ||
          metricOutcome === 'skipped' ||
          metricOutcome === 'skipped_duplicate'
          ? 'ok'
          : 'internal_error',
      );
      transaction?.finish();
      return response;
    } catch (e) {
      // If response generation itself fails (unlikely but possible)
      log.fatal(
        { ...finalLogData, error: (e as Error)?.message },
        'Failed to generate final response after metrics observation',
      );
      // Fallback response
      return new Response(
        JSON.stringify({ error: 'Critical internal error during response generation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  };

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
    const eventPayload = event.payload;
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

    finalLogData = {
      ...eventLogData,
      stripe_event_id: stripeEventId,
      stripe_account_id: stripeAccountId,
      event_type: eventType,
    };

    // --- Idempotency Check --- //
    // Attempt to mark this event buffer ID as processed. If it fails due to
    // unique constraint violation (23505), it means we've processed it before.
    const { error: processedError } = await supabase
      .from('processed_event_buffer_ids')
      .insert({ event_buffer_id: eventBufferId })
      .select('event_buffer_id') // Select minimal column
      .maybeSingle(); // Use maybeSingle to detect conflict

    if (processedError?.code === '23505') {
      // PostgreSQL unique violation code
      metricOutcome = 'skipped_duplicate'; // Use a distinct metric outcome
      log.info(
        { ...finalLogData, status: 200, metric_outcome: metricOutcome },
        'Duplicate event buffer ID detected, skipping processing.',
      );
      status = 200; // Acknowledge receipt to caller (e.g., webhook handler) but do no work.
      return await observeMetricsAndRespond(
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Event already processed' }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }),
        ),
      );
    } else if (processedError) {
      // Any other error during the idempotency check is problematic
      metricOutcome = 'idempotency_error';
      log.error(
        {
          ...finalLogData,
          db_error: processedError.message,
          status: 500,
          metric_outcome: metricOutcome,
        },
        'Failed idempotency check insertion',
      );
      // Treat this as an internal server error
      throw new Error(`Failed idempotency check: ${processedError.message}`);
    }
    // If we reach here, insert succeeded, and this is the first time processing this ID.
    log.debug(
      { ...finalLogData },
      'Idempotency check passed, event buffer ID marked as processed.',
    );
    // --- End Idempotency Check --- //

    // --- Fetch Rule Config BEFORE Transaction ---
    try {
      // Ensure stripeAccountId is not null before passing
      const ruleConfig = await getRuleConfig(stripeAccountId);
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
    // We don't use a client-side transaction here. Atomicity is handled by the RPC.

    try {
      // Idempotency Check (using processed_events table)
      if (!stripeEventId) throw new Error('stripeEventId became null unexpectedly');

      const { error: dupError } = await supabase
        .from('processed_events')
        .insert({ stripe_event_id: stripeEventId })
        .select('stripe_event_id')
        .maybeSingle();

      if (dupError?.code === '23505') {
        // PostgreSQL unique violation
        log.info({ ...finalLogData }, 'Event already processed (idempotency check)');
        metricOutcome = 'skipped';
        status = 204; // No Content for skipped
        const durationMs = Math.round(performance.now() - startTime);
        log.info(
          {
            ...finalLogData,
            duration_ms: durationMs,
            status,
            metric_event: 'reactor_events_total',
            metric_outcome: metricOutcome,
          },
          'Event processing skipped (already processed)',
        );
        return await observeMetricsAndRespond(
          Promise.resolve(new Response(null, { status, headers: { ...corsHeaders } })),
        );
      }
      if (dupError) {
        throw new Error(`Failed idempotency check: ${dupError.message}`);
      }
      log.debug({ ...finalLogData }, 'Idempotency check passed.');

      // TODO: Optional - Add event payload validation here if needed
      // const validatedEvent = validateStripeEvent(eventPayload);
      // if (!validationResult.success) { ... handle validation error ... }

      // Evaluate rules
      let alertsToCreate: { ruleId: string; userId: string }[] = []; // Store details needed for RPC
      let evaluatedAlertCount = 0;
      try {
        const ruleStart = performance.now();
        if (!ruleConfig) throw new Error('Rule config is null');
        // NOTE: evaluateRulesEdge needs to return enough info to call the RPC
        // Assuming it returns an array of objects like: { ruleId: '...', severity: '...', message: '...', etc. } AND the associated user_id.
        // We need to adjust evaluateRulesEdge or how we map its results.
        // FOR NOW: Assume evaluateRulesEdge gives us what we need, including ruleId and userId.
        // Placeholder - this needs actual implementation in evaluateRulesEdge:
        const evaluatedRulesResult = await evaluateRulesEdge(eventPayload, supabase, ruleConfig); // Pass supabase client
        evaluatedAlertCount = evaluatedRulesResult.length;

        if (!stripeAccountId) throw new Error('Missing stripeAccountId for user lookup');
        // Fetch the user_id associated with the stripe_account_id
        // This might be redundant if evaluateRulesEdge already has/returns the user_id
        const { data: accountData, error: accountError } = await supabase
          .from('connected_accounts')
          .select('user_id')
          .eq('stripe_account_id', stripeAccountId)
          .single();

        if (accountError || !accountData?.user_id) {
          throw new Error(
            `Failed to get user_id for account ${stripeAccountId}: ${accountError?.message}`,
          );
        }
        const userId = accountData.user_id;

        // Prepare alerts for the RPC call (simplified for now)
        alertsToCreate = evaluatedRulesResult.map((ruleResult: any) => ({
          // Use 'any' temporarily
          ruleId: ruleResult.ruleId, // Assuming evaluateRulesEdge provides this
          userId: userId, // Use the fetched userId
        }));

        const ruleEvalMs = Math.round(performance.now() - ruleStart);
        log.info(
          {
            ...finalLogData,
            rules_eval_ms: ruleEvalMs,
            evaluated_alert_count: evaluatedAlertCount,
          },
          'Rules evaluated',
        );
      } catch (ruleError: any) {
        if (ruleEvalMs !== null) {
          log.info(
            { ...finalLogData, rules_eval_ms: ruleEvalMs, error: ruleError?.message },
            'Rule evaluation timing before error',
          );
        }
        throw new Error(`Rule evaluation failed: ${ruleError?.message ?? String(ruleError)}`);
      }

      // Insert alerts and enqueue notifications via RPC for each triggered rule
      let createdAlertIds: string[] = [];
      if (alertsToCreate.length > 0) {
        if (!stripeEventId) throw new Error('Missing event ID for alert insertion');
        log.info(
          { ...finalLogData, count: alertsToCreate.length },
          'Attempting to insert alerts and enqueue notifications via RPC...',
        );

        const rpcCalls = alertsToCreate.map((alertInfo) =>
          supabase.rpc('insert_alert_and_enqueue', {
            p_event_id: stripeEventId!, // Assert non-null after check
            p_rule_id: alertInfo.ruleId,
            p_user_id: alertInfo.userId,
            // p_channels: default is ['email', 'slack']
          }),
        );

        const results = await Promise.allSettled(rpcCalls);

        results.forEach((result, index) => {
          const ruleId = alertsToCreate[index].ruleId;
          if (result.status === 'fulfilled') {
            if (result.value.error) {
              log.error(
                { ...finalLogData, rule_id: ruleId, rpc_error: result.value.error },
                'RPC insert_alert_and_enqueue failed',
              );
              // Decide if one failure should fail the whole event? Maybe just log.
            } else {
              log.info(
                { ...finalLogData, rule_id: ruleId, alert_id: result.value.data },
                'RPC insert_alert_and_enqueue succeeded',
              );
              if (result.value.data) {
                alertsTotal.inc({ rule_id: ruleId }); // Increment alert counter on success
                createdAlertIds.push(result.value.data);
              }
            }
          } else {
            log.error(
              { ...finalLogData, rule_id: ruleId, error: result.reason },
              'RPC insert_alert_and_enqueue call failed unexpectedly',
            );
          }
        });
        log.info(
          { ...finalLogData, created_alert_count: createdAlertIds.length },
          'Finished processing RPC calls for alerts.',
        );
      }

      // Success
      metricOutcome = 'success';
      status = 200;
      const durationMs = Math.round(performance.now() - startTime);
      const responsePayload = {
        message: 'Event processed successfully',
        processing_duration_ms: durationMs,
        alerts_created: createdAlertIds.length, // Report count of successfully created alerts
        rules_evaluated: evaluatedAlertCount,
      };
      const successMetrics: Record<string, any> = {
        duration_ms: durationMs,
        alerts_created: responsePayload.alerts_created,
        status,
        metric_event: 'reactor_events_total',
        metric_outcome: metricOutcome,
      };
      if (ruleEvalMs !== null) {
        successMetrics.metric_hist_reactor_eval_ms = ruleEvalMs;
      }
      log.info({ ...finalLogData, ...successMetrics }, 'Event processed successfully');
      return await observeMetricsAndRespond(
        Promise.resolve(
          new Response(JSON.stringify(responsePayload), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }),
        ),
      );
    } catch (error: any) {
      // Capture exceptions before handling DLQ logic
      Sentry.captureException(error, {
        extra: {
          eventBufferId,
          stripeEventId,
          stripeAccountId,
          eventType,
        },
      });
      // --- Error Handling (largely unchanged) --- //
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
            return await observeMetricsAndRespond(
              Promise.resolve(
                new Response(
                  JSON.stringify({ error: `Server error & DLQ failure: ${dlqError.message}` }),
                  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                ),
              ),
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
            return await observeMetricsAndRespond(
              Promise.resolve(
                new Response(
                  JSON.stringify({ error: `Event failed processing and sent to DLQ: ${errorMsg}` }),
                  {
                    status: status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  },
                ),
              ),
            );
          }
        } catch (dlqCatchError: any) {
          metricOutcome = 'critical_error';
          log.fatal(
            { ...finalLogData, err: dlqCatchError?.message },
            'CRITICAL: Unhandled exception during DLQ insertion',
          );
          // Return 500 on unexpected DLQ error
          return await observeMetricsAndRespond(
            Promise.resolve(
              new Response(
                JSON.stringify({ error: 'Critical server error during DLQ processing' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              ),
            ),
          );
        }
      } else {
        // If essential data for DLQ is missing, return a generic server error
        metricOutcome = 'critical_error';
        log.error(
          { ...finalLogData, metric_event: 'reactor_events_total', metric_outcome: metricOutcome },
          'Cannot insert into DLQ due to missing event data',
        );
        return await observeMetricsAndRespond(
          Promise.resolve(
            new Response(JSON.stringify({ error: `Server error: ${errorMsg}` }), {
              status: status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }),
          ),
        );
      }
    }
  } catch (outerError: any) {
    // Capture exceptions before handling DLQ logic
    Sentry.captureException(outerError, {
      extra: {
        eventBufferId,
        stripeEventId,
        stripeAccountId,
        eventType,
      },
    });
    // Ensure the transaction is finished even if observeMetricsAndRespond isn't reached
    // (e.g., due to early errors before the wrapper is called)
    if (!transaction?.endTimestamp) {
      transaction?.setStatus('internal_error'); // Assume error if not finished cleanly
      transaction?.finish();
    }
    status = status >= 400 ? status : 500; // Keep 4xx errors if already set
    const errorMsg = outerError?.message ?? String(outerError);
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
          return await observeMetricsAndRespond(
            Promise.resolve(
              new Response(
                JSON.stringify({ error: `Server error & DLQ failure: ${dlqError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              ),
            ),
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
          return await observeMetricsAndRespond(
            Promise.resolve(
              new Response(
                JSON.stringify({ error: `Event failed processing and sent to DLQ: ${errorMsg}` }),
                { status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              ),
            ),
          );
        }
      } catch (dlqCatchError: any) {
        metricOutcome = 'critical_error';
        log.fatal(
          { ...finalLogData, err: dlqCatchError?.message },
          'CRITICAL: Unhandled exception during DLQ insertion',
        );
        // Return 500 on unexpected DLQ error
        return await observeMetricsAndRespond(
          Promise.resolve(
            new Response(JSON.stringify({ error: 'Critical server error during DLQ processing' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }),
          ),
        );
      }
    } else {
      // If essential data for DLQ is missing, return a generic server error
      metricOutcome = 'critical_error';
      log.error(
        { ...finalLogData, metric_event: 'reactor_events_total', metric_outcome: metricOutcome },
        'Cannot insert into DLQ due to missing event data',
      );
      return await observeMetricsAndRespond(
        Promise.resolve(
          new Response(JSON.stringify({ error: `Server error: ${errorMsg}` }), {
            status: status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }),
        ),
      );
    }
  }
});
