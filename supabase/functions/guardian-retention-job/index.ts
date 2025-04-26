// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';
import dayjs from 'https://esm.sh/dayjs@1.11.7';

// Environment variables & Config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const EVENT_BUFFER_TTL_DAYS = parseInt(Deno.env.get('EVENT_BUFFER_TTL_DAYS') || '30', 10);

// Log environment configurations on cold start
console.log(`Guardian Retention Job running`);
console.log(`Add to .env to adjust: EVENT_BUFFER_TTL_DAYS=${EVENT_BUFFER_TTL_DAYS}`);

// --- Supabase Client ---
const getSupabaseClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// --- Main Handler ---
serve(async (req: Request) => {
  // Allow CORS for direct invocation if needed, but primarily expect cron trigger
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional: Add basic auth or secret header check for direct invocation security
  // const authHeader = req.headers.get('Authorization');
  // if (authHeader !== `Bearer ${Deno.env.get('RETENTION_SECRET')}`) { return new Response('Unauthorized', { status: 401 }) }

  const supabase = getSupabaseClient();
  const startTime = performance.now();
  let scrubbedCount = 0;
  let purgedCount = 0;

  try {
    console.log(`Starting retention job. TTL: ${EVENT_BUFFER_TTL_DAYS} days.`);

    // Step 1: SCRUB events older than TTL
    console.log('Scrubbing old event payloads...');
    const { error: scrubError, count: scrubCount } = await supabase.rpc(
      'scrub_event_buffer',
      {
        ttl_days: EVENT_BUFFER_TTL_DAYS,
      },
      { count: 'exact' },
    ); // Request count if possible (might depend on function definition/permissions)

    if (scrubError) {
      throw new Error(`Failed to scrub event buffer: ${scrubError.message}`);
    }
    // Note: Standard RPC calls don't return a count easily. We might need to query separately or adjust the function.
    // For now, we assume success if no error.
    console.log(`Scrubbing completed (actual count depends on RPC implementation).`);
    // scrubbedCount = scrubCount ?? 0; // Use if count becomes available

    // Step 2: PURGE events older than TTL + 7 days (safety buffer)
    const purgeCutoffDate = dayjs()
      .subtract(EVENT_BUFFER_TTL_DAYS + 7, 'day')
      .toISOString();
    console.log(`Purging events received before ${purgeCutoffDate}...`);

    const { error: purgeError, count: deleteCount } = await supabase
      .from('event_buffer')
      .delete({ count: 'exact' })
      .lt('received_at', purgeCutoffDate);

    if (purgeError) {
      throw new Error(`Failed to purge old events: ${purgeError.message}`);
    }
    purgedCount = deleteCount ?? 0;
    console.log(`Purging completed. Deleted ${purgedCount} events.`);

    const duration = Math.round(performance.now() - startTime);
    console.log(`Retention job finished in ${duration}ms.`);

    return new Response(
      JSON.stringify({
        message: 'Retention job complete',
        // scrubbed: scrubbedCount, // Add back if count is available
        purged: purgedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error(`Retention job error: ${error.message}`, error.stack);
    return new Response(JSON.stringify({ error: `Server error: ${error.message || error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
