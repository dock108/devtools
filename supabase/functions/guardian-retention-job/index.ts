// @ts-expect-error: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';
import dayjs from 'https://esm.sh/dayjs@1.11.7';
import { log, generateRequestId } from '../../lib/logger.ts'; // Adjust path

// Environment variables & Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const EVENT_BUFFER_TTL_DAYS = parseInt(Deno.env.get('EVENT_BUFFER_TTL_DAYS') || '30', 10);

// Log config on cold start
log.info(`Guardian Retention Job running`);
log.info(`Add to .env to adjust: EVENT_BUFFER_TTL_DAYS=${EVENT_BUFFER_TTL_DAYS}`);

// --- Supabase Client ---
const getSupabaseClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// --- Main Handler ---
serve(async (req: Request) => {
  const reqId = generateRequestId();
  const baseLogData = { req_id: reqId, service: 'guardian-retention-job' };
  log.info({ ...baseLogData, method: req.method, url: req.url }, 'Retention job triggered');

  // Allow CORS for direct invocation if needed
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional: Auth check
  // const authHeader = req.headers.get('Authorization');
  // if (authHeader !== `Bearer ${Deno.env.get('RETENTION_SECRET')}`) { return new Response('Unauthorized', { status: 401 }) }

  const supabase = getSupabaseClient();
  const startTime = performance.now();
  let scrubbedResultCount: number | null = null; // Count is tricky with RPC
  let purgedCount = 0;
  let status = 500;

  try {
    log.info({ ...baseLogData, ttl_days: EVENT_BUFFER_TTL_DAYS }, `Starting retention job.`);

    // Step 1: SCRUB
    log.info({ ...baseLogData }, 'Scrubbing old event payloads...');
    // Note: supabase.rpc doesn't easily return the count of affected rows without modifying the function.
    // We log success/failure based on error presence.
    const { error: scrubError } = await supabase.rpc('scrub_event_buffer', {
      ttl_days: EVENT_BUFFER_TTL_DAYS,
    });

    if (scrubError) {
      log.error({ ...baseLogData, err: scrubError.message }, 'Failed to scrub event buffer');
      throw new Error(`Failed to scrub event buffer: ${scrubError.message}`);
    }
    log.info({ ...baseLogData }, `Scrubbing function executed successfully.`);
    // To get the count, you might query afterwards:
    // const { count: actualScrubCount, error: countError } = await supabase
    //   .from('event_buffer')
    //   .select('id', { count: 'exact', head: true })
    //   .eq('is_scrubbed', true)
    //   .lt('received_at', dayjs().subtract(EVENT_BUFFER_TTL_DAYS, 'day').toISOString());
    // scrubbedResultCount = actualScrubCount;

    // Step 2: PURGE
    const purgeDelayDays = 7;
    const purgeCutoffDate = dayjs()
      .subtract(EVENT_BUFFER_TTL_DAYS + purgeDelayDays, 'day')
      .toISOString();
    log.info(
      { ...baseLogData, purge_cutoff_date: purgeCutoffDate },
      `Purging events received before cutoff...`,
    );

    const { error: purgeError, count: deleteCount } = await supabase
      .from('event_buffer')
      .delete({ count: 'exact' })
      .lt('received_at', purgeCutoffDate);

    if (purgeError) {
      log.error({ ...baseLogData, err: purgeError.message }, 'Failed to purge old events');
      throw new Error(`Failed to purge old events: ${purgeError.message}`);
    }
    purgedCount = deleteCount ?? 0;
    log.info({ ...baseLogData, purged_count: purgedCount }, `Purging completed.`);

    status = 200;
    const durationMs = Math.round(performance.now() - startTime);
    const summary = {
      scrubbed_count: scrubbedResultCount,
      purged_count: purgedCount,
      duration_ms: durationMs,
    };
    log.info({ ...baseLogData, ...summary, status }, `Retention job finished`);

    return new Response(JSON.stringify({ message: 'Retention job complete', ...summary }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    log.error(
      { ...baseLogData, err: error.message, duration_ms: durationMs, status, stack: error.stack },
      `Retention job error`,
    );
    return new Response(JSON.stringify({ error: `Server error: ${error.message || error}` }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
