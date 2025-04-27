// @ts-expect-error: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';
import { log, generateRequestId } from '../../lib/logger.ts'; // Adjust path
import { updateDlqGauge } from '../../lib/metrics.ts'; // Import gauge updater

// Environment variables & Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REACTOR_URL =
  Deno.env.get('REACTOR_INTERNAL_URL') || `${SUPABASE_URL}/functions/v1/guardian-reactor`;
const DLQ_RETRY_BATCH = parseInt(Deno.env.get('DLQ_RETRY_BATCH') || '100', 10);
const DLQ_MAX_RETRIES = parseInt(Deno.env.get('DLQ_MAX_RETRIES') || '10', 10);

// Log environment configurations on cold start
log.info(`Guardian DLQ Retry running`);
log.info(
  `Add to .env to tweak: DLQ_RETRY_BATCH=${DLQ_RETRY_BATCH} DLQ_MAX_RETRIES=${DLQ_MAX_RETRIES}`,
);
log.info(`Using Reactor URL: ${REACTOR_URL}`);

// --- Types ---
interface FailedEvent {
  id: string;
  event_buffer_id: string;
  stripe_event_id: string;
  payload: any;
  retry_count: number;
}

// --- Supabase Client ---
const getSupabaseClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// --- Exponential Backoff Calculation ---
function calculateNextAttempt(retryCount: number): string {
  // Exponential backoff: min(2^retryCount, 60) minutes
  const delayMinutes = Math.min(Math.pow(2, retryCount), 60);
  const nextAttempt = new Date();
  nextAttempt.setMinutes(nextAttempt.getMinutes() + delayMinutes);
  return nextAttempt.toISOString();
}

// --- Main Handler ---
serve(async (req: Request) => {
  const reqId = generateRequestId();
  const baseLogData = { req_id: reqId, service: 'guardian-retry-dlq' };
  log.info({ ...baseLogData, method: req.method, url: req.url }, 'DLQ retry job triggered');

  // Allow CORS for direct invocation if needed, but primarily expect cron trigger
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional: Add basic auth or secret header check for direct invocation security
  // const authHeader = req.headers.get('Authorization');
  // if (authHeader !== `Bearer ${Deno.env.get('RETRY_SECRET')}`) { ... }

  const supabase = getSupabaseClient();
  const startTime = performance.now();
  let processedCount = 0;
  let failureCount = 0; // Count reactor failures
  let maxRetriesCount = 0;
  let internalErrorCount = 0; // Count errors within the retry function itself

  try {
    // 1. Select rows ready for retry
    const { data: eventsToRetry, error: fetchError } = await supabase
      .from('failed_event_dispatch')
      .select('*')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(DLQ_RETRY_BATCH);

    if (fetchError) {
      log.error({ ...baseLogData, err: fetchError.message }, 'Failed to fetch DLQ events');
      throw new Error(`Failed to fetch DLQ events: ${fetchError.message}`);
    }

    if (!eventsToRetry || eventsToRetry.length === 0) {
      log.info({ ...baseLogData }, 'No events ready for retry.');
      return new Response(JSON.stringify({ message: 'No events to retry' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log.info(
      { ...baseLogData, batch_size: eventsToRetry.length },
      `Found ${eventsToRetry.length} events to retry.`,
    );

    // 2. Process each event
    for (const event of eventsToRetry as FailedEvent[]) {
      const eventLogData = {
        ...baseLogData,
        dlq_id: event.id,
        event_buffer_id: event.event_buffer_id,
        stripe_event_id: event.stripe_event_id,
      };
      let metricOutcome = 'unknown'; // Default for this attempt
      try {
        // *** Use the stored event_buffer_id ***
        if (!event.event_buffer_id) {
          log.error(
            { ...eventLogData },
            `DLQ row ${event.id} is missing event_buffer_id. Cannot retry.`,
          );
          // Update the row to prevent constant re-fetching?
          await supabase
            .from('failed_event_dispatch')
            .update({ last_error: 'Missing event_buffer_id, cannot retry.', next_attempt_at: null })
            .eq('id', event.id);
          internalErrorCount++;
          continue; // Skip to next event
        }

        log.debug({ ...eventLogData }, 'Attempting to process DLQ event via reactor');
        const response = await fetch(REACTOR_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use service key for internal function calls
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY, // Supabase often requires apikey too
          },
          body: JSON.stringify({ event_buffer_id: event.event_buffer_id }),
        });

        // 3. On success: delete the DLQ row
        if (response.ok || response.status === 204) {
          metricOutcome = 'success';
          const { error: deleteError } = await supabase
            .from('failed_event_dispatch')
            .delete()
            .eq('id', event.id);

          if (deleteError) {
            log.error(
              { ...eventLogData, err: deleteError.message },
              `Failed to delete DLQ row ${event.id}`,
            );
            internalErrorCount++; // Count as internal error if delete fails
          } else {
            log.info(
              {
                ...eventLogData,
                reactor_status: response.status,
                metric_event: 'dlq_retry_attempts_total',
                metric_outcome: metricOutcome,
              },
              `Successfully processed and deleted DLQ event`,
            );
            processedCount++;
          }
        } else {
          // 4. On failure: increment retry_count, update last_error, set next_attempt_at
          metricOutcome = 'failure';
          log.warn(
            { ...eventLogData, reactor_status: response.status },
            `Failed to process event ${event.stripe_event_id} via reactor`,
          );
          const newRetryCount = event.retry_count + 1;
          // Try to get a more specific error message from the response body
          let reactorErrorMessage = `Reactor failed with status ${response.status}`;
          try {
            const errorBody = await response.json();
            reactorErrorMessage = errorBody.error || JSON.stringify(errorBody);
          } catch {
            /* Ignore if body isn't JSON */
          }

          const errorMessage = `Retry failed: ${reactorErrorMessage}`;

          if (newRetryCount > DLQ_MAX_RETRIES) {
            metricOutcome = 'max_retries';
            log.error(
              {
                ...eventLogData,
                retry_count: newRetryCount,
                metric_event: 'dlq_retry_attempts_total',
                metric_outcome: metricOutcome,
              },
              `Event exceeded max retries`,
            );
            // Update error one last time, but don't reschedule
            await supabase
              .from('failed_event_dispatch')
              .update({ last_error: `MAX RETRIES REACHED: ${errorMessage}`, next_attempt_at: null })
              .eq('id', event.id);
            maxRetriesCount++;
            failureCount++;
          } else {
            const nextAttemptAt = calculateNextAttempt(newRetryCount);
            const { error: updateError } = await supabase
              .from('failed_event_dispatch')
              .update({
                retry_count: newRetryCount,
                last_error: errorMessage,
                next_attempt_at: nextAttemptAt,
              })
              .eq('id', event.id);

            if (updateError) {
              log.error(
                { ...eventLogData, err: updateError.message },
                `Failed to update DLQ row ${event.id} after failure`,
              );
              internalErrorCount++;
            } else {
              log.info(
                {
                  ...eventLogData,
                  retry_count: newRetryCount,
                  next_attempt_at: nextAttemptAt,
                  metric_event: 'dlq_retry_attempts_total',
                  metric_outcome: metricOutcome,
                },
                `Rescheduled event for retry`,
              );
              failureCount++; // Still counts as a failure outcome for this attempt
            }
          }
        }
      } catch (processingError) {
        metricOutcome = 'error'; // Internal error during processing
        log.error(
          {
            ...eventLogData,
            err: processingError.message,
            metric_event: 'dlq_retry_attempts_total',
            metric_outcome: metricOutcome,
          },
          `Error processing DLQ event`,
        );
        internalErrorCount++;
        // Potentially update the DLQ row with this internal error if desired
      }
    }

    // Update DLQ Size Gauge after processing the batch
    await updateDlqGauge(supabase);
    const { count: finalDlqSize } = await supabase
      .from('failed_event_dispatch')
      .select('id', { count: 'exact', head: true });

    const durationMs = Math.round(performance.now() - startTime);
    const summary = {
      duration_ms: durationMs,
      processed_ok: processedCount,
      failed_reactor: failureCount,
      failed_permanently: maxRetriesCount,
      failed_internal: internalErrorCount,
      batch_size: eventsToRetry.length,
      final_dlq_size: finalDlqSize ?? -1, // Log final size
    };
    // Log metric data for the gauge
    log.info(
      { ...baseLogData, ...summary, metric_gauge_dlq_size: finalDlqSize ?? -1 },
      `DLQ Retry finished`,
    );

    return new Response(
      JSON.stringify({
        message: 'DLQ retry run complete',
        ...summary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    log.error(
      { ...baseLogData, err: error.message, stack: error.stack },
      `DLQ Retry function error`,
    );
    return new Response(JSON.stringify({ error: `Server error: ${error.message || error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
