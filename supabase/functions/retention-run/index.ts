// @ts-ignore: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { corsHeaders } from '../_shared/cors.ts';
import { log, generateRequestId } from '../_shared/logger.ts'; // Assuming shared logger

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
  );
}

const getSupabaseClient = (): SupabaseClient => {
  // Create a new client for each request to ensure isolation? Or reuse?
  // For service role, reusing might be fine.
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // Prevent storing user session when using service key
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

serve(async (req: Request) => {
  const reqId = generateRequestId();
  const baseLogData = { req_id: reqId, service: 'retention-run' };
  log.info({ ...baseLogData, method: req.method }, 'Incoming retention run request');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests for triggering the job
  if (req.method !== 'POST') {
    log.warn({ ...baseLogData, status: 405 }, 'Method not allowed');
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Optional: Add authentication/authorization here if needed
  // e.g., check for a specific API key or admin user role

  const startTime = performance.now();
  let status = 500;

  try {
    const supabase = getSupabaseClient();
    log.info({ ...baseLogData }, 'Attempting to call guardian_run_retention procedure...');

    // Call the stored procedure
    // Note: CALL procedure doesn't return data like SELECT function()
    // We just check for errors.
    const { error: rpcError } = await supabase.rpc('guardian_run_retention');

    const durationMs = Math.round(performance.now() - startTime);

    if (rpcError) {
      log.error(
        { ...baseLogData, duration_ms: durationMs, err: rpcError.message },
        'Error calling guardian_run_retention',
      );
      status = 500;
      return new Response(
        JSON.stringify({ error: 'Failed to run retention job', details: rpcError.message }),
        {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    log.info(
      { ...baseLogData, duration_ms: durationMs },
      'Successfully called guardian_run_retention',
    );
    status = 200;
    return new Response(JSON.stringify({ message: 'Retention job triggered successfully' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - startTime);
    log.error(
      { ...baseLogData, duration_ms: durationMs, err: error?.message, status: 500 },
      'Unhandled error in retention-run function',
    );
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error?.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
