import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry which registers the metrics
export const registry = new Registry();

// Enable default metrics collection (optional)
collectDefaultMetrics({ register: registry });

// --- Webhook Metrics --- (Collected in Next.js API Route)
export const webhookRequests = new Counter({
  name: 'webhook_requests_total',
  help: 'Total number of Stripe webhook requests received',
  labelNames: ['status', 'event_type'],
  registers: [registry],
});

export const webhookDuration = new Histogram({
  name: 'webhook_duration_ms',
  help: 'Duration of Stripe webhook request processing in milliseconds',
  labelNames: ['status', 'event_type'],
  buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000], // Adjusted buckets
  registers: [registry],
});

// --- Reactor Metrics --- (Collected in Supabase Edge Function)
export const reactorEvents = new Counter({
  name: 'reactor_events_total',
  help: 'Total number of events processed by the reactor',
  labelNames: ['result'], // 'success', 'skipped', 'dlq_error', 'critical_error'
  registers: [registry],
});

export const reactorEvalDuration = new Histogram({
  name: 'reactor_eval_ms',
  help: 'Duration of rule evaluation within the reactor in milliseconds',
  // No labels needed if measured universally
  buckets: [10, 25, 50, 100, 250, 500, 1000], // Tighter buckets for eval
  registers: [registry],
});

// --- DLQ Retry Metrics --- (Collected in Supabase Edge Function)
export const dlqRetryAttempts = new Counter({
  name: 'dlq_retry_attempts_total',
  help: 'Total number of DLQ retry attempts made',
  labelNames: ['outcome'], // 'success', 'failure', 'max_retries'
  registers: [registry],
});

export const dlqSize = new Gauge({
  name: 'dlq_size',
  help: 'Current number of items in the Dead Letter Queue',
  registers: [registry],
  async collect() {
    // This needs to be implemented where the Supabase client is available.
    // Ideally, the retry function updates this gauge periodically.
    // Placeholder: this.set(0);
  },
});

// Function to update DLQ size (call this from the retry function)
export async function updateDlqGauge(supabaseClient: any) {
  try {
    const { count, error } = await supabaseClient
      .from('failed_event_dispatch')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Failed to fetch DLQ count for metrics:', error.message);
      // Optionally set to a specific value like -1 to indicate error
    } else {
      dlqSize.set(count ?? 0);
    }
  } catch (err) {
    console.error('Exception fetching DLQ count for metrics:', err.message);
  }
}
