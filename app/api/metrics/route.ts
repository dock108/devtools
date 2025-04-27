import { NextResponse } from 'next/server';
import { register, retentionLastRunTimestampSeconds } from '@/lib/metrics/registry';
import { Buffer } from 'buffer'; // Node.js Buffer for basic auth decoding
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

const JOB_NAME = 'guardian_retention'; // Must match the job name in the heartbeat table

// Helper function for Basic Auth check
function checkAuth(request: Request): boolean {
  const expectedKey = process.env.PROM_METRICS_KEY;
  // If no key is set, allow access only in non-production environments
  if (!expectedKey) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    // Expecting format like '_:YOUR_PROM_METRICS_KEY' or 'user:YOUR_PROM_METRICS_KEY'
    const [user, key] = credentials.split(':');
    return key === expectedKey;
  } catch (e) {
    console.error('Error decoding Basic Auth credentials:', e);
    return false;
  }
}

export async function GET(request: Request) {
  // Environment/Auth Check
  if (process.env.NODE_ENV === 'production' && !checkAuth(request)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
    });
  }

  // --- Update dynamic gauges before serving --- //
  try {
    const cookieStore = cookies();
    // Use service role key for direct DB access if needed, or anon key if RLS allows
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Use service role key if RLS prevents anon key reading job_heartbeat
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { get: (name: string) => cookieStore.get(name)?.value },
        auth: { persistSession: false }, // Don't persist session for metrics endpoint
      },
    );

    const { data, error } = await supabase
      .from('job_heartbeat')
      .select('ran_at')
      .eq('job_name', JOB_NAME)
      .maybeSingle();

    if (error) {
      console.error('[Metrics API] Error fetching retention heartbeat:', error.message);
      // Don't update gauge if fetch fails, it will keep its last value or be absent
    } else if (data?.ran_at) {
      const lastRunTimestamp = new Date(data.ran_at).getTime() / 1000; // Convert to Unix seconds
      retentionLastRunTimestampSeconds.set(lastRunTimestamp);
    } else {
      // Job hasn't run yet, explicitly set to 0 or a known value?
      retentionLastRunTimestampSeconds.set(0);
    }
  } catch (dbError: any) {
    console.error('[Metrics API] Exception fetching retention heartbeat:', dbError.message);
  }
  // --- End dynamic gauge update --- //

  // Return metrics
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: { 'Content-Type': register.contentType },
    });
  } catch (error: any) {
    console.error('[Metrics API] Error generating metrics:', error);
    return new NextResponse(`Error generating metrics: ${error.message}`, {
      status: 500,
    });
  }
}
