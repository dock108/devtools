// @ts-expect-error: Deno-specific globals
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { log } from '../../lib/logger.ts';

// --- Config ---
const METRICS_AUTH_TOKEN = Deno.env.get('METRICS_AUTH_TOKEN');

// Log config on cold start
log.info('Guardian Metrics endpoint initialized');
if (!METRICS_AUTH_TOKEN) {
  log.warn('METRICS_AUTH_TOKEN is not set. Metrics endpoint will be inaccessible.');
  log.info('Add to .env for metrics auth: METRICS_AUTH_TOKEN=changeme');
} else {
  log.info('Metrics endpoint requires Bearer token authentication.');
}

serve(async (req: Request) => {
  const reqId = log.bindings().req_id || 'unknown'; // Use parent logger context if available
  const baseLogData = { req_id: reqId, service: 'guardian-metrics' };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.debug({ ...baseLogData }, 'Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // --- Authentication ---
  if (!METRICS_AUTH_TOKEN) {
    log.error({ ...baseLogData, status: 500 }, 'Metrics auth token not configured on server.');
    return new Response(JSON.stringify({ error: 'Metrics endpoint not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')?.[1];

  if (!token || token !== METRICS_AUTH_TOKEN) {
    log.warn({ ...baseLogData, status: 401 }, 'Unauthorized attempt to access metrics endpoint.');
    return new Response('Unauthorized', {
      status: 401,
      headers: { ...corsHeaders }, // Add CORS headers even for errors
    });
  }

  // --- Metrics Generation (Placeholder) ---
  // In a real scenario with log-based metrics, this endpoint might not be needed,
  // or it could potentially query the log aggregation system.
  // For now, return a placeholder or simulate metrics based on recent logs if feasible.

  // Placeholder Response:
  log.info(
    { ...baseLogData, status: 200 },
    'Metrics endpoint accessed successfully (placeholder response).',
  );
  const placeholderMetrics = `# HELP placeholder_metric Example metric
# TYPE placeholder_metric gauge
placeholder_metric 1
`;

  return new Response(placeholderMetrics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
});
