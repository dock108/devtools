// @ts-expect-error: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
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

// Function to get user from JWT
async function getUserByJWT(supabase: SupabaseClient, req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const jwt = authHeader.substring(7); // Extract JWT
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  if (error) {
    log.warn({ req_id: (req as any).req_id, err: error.message }, 'Failed to get user from JWT');
    return null;
  }
  return user;
}

// Function to check if user is admin
function isAdminUser(user: User | null): boolean {
  // Adjust based on where admin role is stored (e.g., app_metadata, user_metadata, or a custom table)
  return user?.user_metadata?.role === 'admin';
}

serve(async (req: Request) => {
  const reqId = generateRequestId();
  (req as any).req_id = reqId; // Attach reqId for use in helper functions
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

  // Authentication & Authorization Check
  const supabaseAuthClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    // Use service key for getUser
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = await getUserByJWT(supabaseAuthClient, req);

  if (!user) {
    log.warn({ ...baseLogData, status: 401 }, 'Unauthorized: No valid user session found');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isAdminUser(user)) {
    log.warn({ ...baseLogData, user_id: user.id, status: 403 }, 'Forbidden: User is not an admin');
    return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  log.info(
    { ...baseLogData, user_id: user.id },
    'Admin user authorized. Proceeding with retention run.',
  );

  // --- Proceed with job execution ---
  const startTime = performance.now();
  let status = 500;
  const supabaseService = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    // Separate client for RPC
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    log.info({ ...baseLogData }, 'Attempting to call guardian_run_retention procedure...');
    const { error: rpcError } = await supabaseService.rpc('guardian_run_retention');

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
