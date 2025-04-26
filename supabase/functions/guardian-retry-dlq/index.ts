// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';

// Environment variables & Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REACTOR_URL =
  Deno.env.get('REACTOR_INTERNAL_URL') || `${SUPABASE_URL}/functions/v1/guardian-reactor`;
const DLQ_RETRY_BATCH = parseInt(Deno.env.get('DLQ_RETRY_BATCH') || '100', 10);
const DLQ_MAX_RETRIES = parseInt(Deno.env.get('DLQ_MAX_RETRIES') || '10', 10);

// Log environment configurations on cold start
console.log(`Guardian DLQ Retry running`);
console.log(
  `Add to .env to tweak: DLQ_RETRY_BATCH=${DLQ_RETRY_BATCH} DLQ_MAX_RETRIES=${DLQ_MAX_RETRIES}`,
);
console.log(`Using Reactor URL: ${REACTOR_URL}`);

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
  // Allow CORS for direct invocation if needed, but primarily expect cron trigger
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional: Add basic auth or secret header check for direct invocation security
  // const authHeader = req.headers.get('Authorization');
  // if (authHeader !== `Bearer ${Deno.env.get('RETRY_SECRET')}`) { ... }

  const supabase = getSupabaseClient();
  const startTime = performance.now();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 1. Select rows ready for retry
    const { data: eventsToRetry, error: fetchError } = await supabase
      .from('failed_event_dispatch')
      .select('*')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(DLQ_RETRY_BATCH);

    if (fetchError) {
      throw new Error(`Failed to fetch DLQ events: ${fetchError.message}`);
    }

    if (!eventsToRetry || eventsToRetry.length === 0) {
      console.log('No events ready for retry.');
      return new Response(JSON.stringify({ message: 'No events to retry' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${eventsToRetry.length} events to retry.`);

    // 2. Process each event
    for (const event of eventsToRetry as FailedEvent[]) {
      try {
        // *** Use the stored event_buffer_id ***
        if (!event.event_buffer_id) {
          console.error(`DLQ row ${event.id} is missing event_buffer_id. Cannot retry.`);
          // Update the row to prevent constant re-fetching?
          await supabase
            .from('failed_event_dispatch')
            .update({ last_error: 'Missing event_buffer_id, cannot retry.', next_attempt_at: null })
            .eq('id', event.id);
          errorCount++;
          continue; // Skip to next event
        }

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
          const { error: deleteError } = await supabase
            .from('failed_event_dispatch')
            .delete()
            .eq('id', event.id);

          if (deleteError) {
            console.error(`Failed to delete DLQ row ${event.id}: ${deleteError.message}`);
            // Log error but continue processing others
            errorCount++;
          } else {
            console.log(`Successfully processed and deleted DLQ event ${event.stripe_event_id}`);
            processedCount++;
          }
        } else {
          // 4. On failure: increment retry_count, update last_error, set next_attempt_at
          console.warn(
            `Failed to process event ${event.stripe_event_id} via reactor. Status: ${response.status}`,
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
            console.error(
              `Event ${event.stripe_event_id} exceeded max retries (${DLQ_MAX_RETRIES}). Leaving in DLQ for manual review.`,
            );
            // Update error one last time, but don't reschedule
            await supabase
              .from('failed_event_dispatch')
              .update({ last_error: `MAX RETRIES REACHED: ${errorMessage}` })
              .eq('id', event.id);
            errorCount++;
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
              console.error(
                `Failed to update DLQ row ${event.id} after failure: ${updateError.message}`,
              );
              errorCount++;
            } else {
              console.log(
                `Rescheduled event ${event.stripe_event_id} for retry at ${nextAttemptAt}`,
              );
              errorCount++; // Still counts as an error for this run
            }
          }
        }
      } catch (processingError) {
        console.error(
          `Error processing DLQ event ${event.id} (${event.stripe_event_id}): ${processingError.message}`,
        );
        errorCount++;
        // Potentially update the DLQ row with this internal error if desired
      }
    }

    const duration = Math.round(performance.now() - startTime);
    console.log(
      `DLQ Retry finished in ${duration}ms. Processed: ${processedCount}, Failed/Rescheduled: ${errorCount}`,
    );

    return new Response(
      JSON.stringify({
        message: 'DLQ retry run complete',
        processed: processedCount,
        failed: errorCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error(`DLQ Retry function error: ${error.message}`, error.stack);
    return new Response(JSON.stringify({ error: `Server error: ${error.message || error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
