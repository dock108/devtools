# Guardian Prometheus Metrics

Guardian exposes key operational metrics in Prometheus exposition format. This allows monitoring of system health, performance, and throughput using Prometheus and visualization tools like Grafana.

## Accessing Metrics

Metrics are exposed via two endpoints:

1.  **Next.js API Route:** `/api/metrics`

    - Exposes metrics primarily related to the Stripe webhook handler running in the Next.js application.
    - Access control: Currently open, but can be secured via standard Next.js middleware if needed.

2.  **Supabase Edge Function:** `/functions/v1/guardian-metrics`
    - Intended to expose metrics from Supabase Edge Functions (Reactor, DLQ Retry, Retention Job).
    - **Requires Authentication**: Access requires a Bearer token in the `Authorization` header matching the `METRICS_AUTH_TOKEN` environment variable configured for the function.
    - **Note:** Due to the stateless nature of Edge Functions, live metric scraping via `prom-client` is challenging. This endpoint currently serves as a placeholder and requires authentication. The primary way to gather metrics from Edge Functions is via **Log-Based Metrics**.

## Log-Based Metrics (Recommended for Edge Functions)

Guardian Edge Functions (Reactor, DLQ Retry, Retention Job) emit structured JSON logs containing specific fields that can be parsed by a log aggregation platform (like Logflare, Datadog, Grafana Loki) to generate metrics.

Look for logs containing fields prefixed with `metric_`:

- `metric_event`: (String) The base name of the metric (e.g., `reactor_events_total`, `dlq_retry_attempts_total`).
- `metric_outcome`: (String) A label value indicating the result (e.g., `success`, `skipped`, `failure`, `max_retries`). Used for counters.
- `metric_gauge_[metric_name]`: (Number) The value for a gauge metric (e.g., `metric_gauge_dlq_size: 5`).
- `metric_hist_[metric_name]`: (Number) The observed value for a histogram (e.g., `metric_hist_reactor_eval_ms: 125`).

**Example Log for Reactor Success:**

```json
{
  "level": "info", ...,
  "service": "guardian-reactor", ...,
  "metric_event": "reactor_events_total",
  "metric_outcome": "success",
  "metric_hist_reactor_eval_ms": 85,
  "duration_ms": 150, ...
}
```

**Example Log for DLQ Retry Summary:**

```json
{
  "level": "info", ...,
  "service": "guardian-retry-dlq", ...,
  "processed_ok": 8,
  "failed_reactor": 2,
  "failed_permanently": 1,
  "batch_size": 10,
  "metric_gauge_dlq_size": 15, ...
}
```

Configure your logging platform to parse these fields and generate the corresponding Prometheus metrics.

## Exposed Metrics (via `/api/metrics` and Logs)

**Webhook Handler:**

- `webhook_requests_total` (Counter): Total webhook requests received.
  - Labels: `status` (HTTP status code), `event_type` (Stripe event type).
- `webhook_duration_ms` (Histogram): Request processing duration.
  - Labels: `status`, `event_type`.

**Reactor:**

- `reactor_events_total` (Counter): Total events processed by the reactor.
  - Labels: `result` (`success`, `skipped`, `dlq_error`, `critical_error`).
- `reactor_eval_ms` (Histogram): Rule evaluation duration.

**DLQ Retry Job:**

- `dlq_retry_attempts_total` (Counter): Total retry attempts.
  - Labels: `outcome` (`success`, `failure`, `max_retries`, `error`).
- `dlq_size` (Gauge): Current number of events in the DLQ.

## Scraping Configuration

**Prometheus (`prometheus.yml`):**

```yaml
scrape_configs:
  - job_name: 'guardian-nextjs'
    static_configs:
      - targets: ['your-app-domain.com'] # Replace with your app URL
    metrics_path: /api/metrics
    # Add scheme (http/https) if needed

  # Example for Supabase Function (if direct scraping were feasible & needed)
  # - job_name: 'guardian-supabase-metrics'
  #   static_configs:
  #     - targets: ['your-supabase-project-ref.supabase.co']
  #   metrics_path: /functions/v1/guardian-metrics
  #   scheme: https
  #   bearer_token: 'YOUR_METRICS_AUTH_TOKEN'
```

**Grafana Agent:**

Configure the Grafana Agent similarly, pointing to `/api/metrics` for the Next.js app. For Edge Function metrics, configure the agent to scrape your log aggregation platform (e.g., Loki) and derive metrics from the structured logs.

## Dashboard

A starter Grafana dashboard definition is available at `docs/guardian/grafana.json`. Import this into your Grafana instance and configure the Prometheus datasource to visualize key Guardian metrics.
