# Guardian Structured Logging

Guardian components (webhook handler, reactor, retry job, retention job) use structured JSON logging via the Pino library to provide consistent and parseable log output.

## Log Format

All log entries follow a standard JSON format, including common base fields and component-specific context.

**Base Fields:**

- `level`: (String) Log level (e.g., `info`, `warn`, `error`, `debug`). Matches Pino's standard numeric levels internally.
- `time`: (String) ISO 8601 timestamp (e.g., `"2025-04-26T10:30:15.123Z"`).
- `pid`: (Number) Process ID (if applicable).
- `hostname`: (String) Server hostname (if applicable).
- `env`: (String) Node environment (`development`, `production`, `test`).
- `service`: (String) Name of the Guardian service/component (e.g., `webhook-handler`, `guardian-reactor`, `guardian-retry-dlq`, `guardian-retention-job`).
- `req_id`: (String) Unique request identifier (UUID v4) generated for each incoming request or job invocation.
- `msg`: (String) The human-readable log message.

**Common Contextual Fields:**

- `stripe_event_id`: (String) The ID of the Stripe event being processed (e.g., `evt_xxx`).
- `event_buffer_id`: (String) The UUID of the corresponding record in the `event_buffer` table.
- `stripe_account_id`: (String) The target Stripe connected account ID (e.g., `acct_xxx`).
- `duration_ms`: (Number) Duration of an operation in milliseconds.
- `status`: (Number) HTTP status code associated with the request/response.
- `err`: (String) Error message if logging an error.
- `stack`: (String) Error stack trace if available.
- `metric_*`: Fields related to metrics emitted via logs (see Metrics documentation).

## Sample Log Entry (Webhook Success)

```json
{
  "level": "info",
  "time": "2025-04-26T10:31:05.456Z",
  "pid": 12345,
  "hostname": "vercel-host-abc",
  "env": "production",
  "service": "webhook-handler",
  "req_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "stripe_event_id": "evt_1PQAraLkdIwHu7ixxxxxxxx",
  "stripe_account_id": "acct_1M7qfXLkdIwHu7ix",
  "duration_ms": 75,
  "status": 200,
  "msg": "Webhook processing complete"
}
```

## Sample Log Entry (Reactor DLQ Error)

```json
{
  "level": "error",
  "time": "2025-04-26T10:35:22.987Z",
  "pid": 54321,
  "hostname": "deno-edge-runtime",
  "env": "production",
  "service": "guardian-reactor",
  "req_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "event_buffer_id": "c4d5e6f7-abcd-efgh-ijkl-mnopqrstuvwx",
  "stripe_event_id": "evt_1PQAraLkdIwHu7ixYYYYYYYY",
  "stripe_account_id": "acct_1M7qfXLkdIwHu7ix",
  "err": "Rule evaluation failed: Timeout connecting to database",
  "status": 500,
  "dlq_error": "Constraint violation inserting into failed_event_dispatch",
  "metric_event": "reactor_events_total",
  "metric_outcome": "critical_error",
  "msg": "Failed to insert into DLQ"
}
```

## Configuration

- `LOG_LEVEL`: Set this environment variable (e.g., `debug`, `info`, `warn`, `error`) to control log verbosity. Defaults to `info`.

## Integration

These structured logs are designed to be forwarded to a log management and analysis platform (e.g., Logflare, Datadog, Splunk, Grafana Loki) for searching, monitoring, and alerting.
