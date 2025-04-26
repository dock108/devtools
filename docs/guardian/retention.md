# Guardian Data Retention Policy

Guardian stores incoming Stripe event payloads in the `event_buffer` table for rule evaluation and debugging purposes. To comply with data privacy regulations like GDPR and manage storage costs, a data retention policy is automatically enforced.

## Policy

Guardian employs a two-step retention process:

1.  **Scrubbing (Anonymization)**: After **30 days** (configurable via `EVENT_BUFFER_TTL_DAYS`), the `payload` JSONb object for an event in the `event_buffer` table is automatically scrubbed. This process removes all data except for the essential `data.id` field (the Stripe object ID, e.g., `pi_xxx`, `evt_xxx`). The `is_scrubbed` flag is set to `true` to prevent re-processing.

    ```json
    // Before Scrubbing (Example: charge.succeeded)
    {
      "id": "evt_123...",
      "account": "acct_abc...",
      "api_version": "2022-11-15",
      "created": 1678886400,
      "data": {
        "object": {
          "id": "pi_abc...",
          "amount": 1000,
          "currency": "usd",
          "customer": "cus_xyz...", // PII
          "description": "Sensitive info", // PII
          // ... other fields
        }
      },
      "livemode": false,
      "type": "charge.succeeded"
    }

    // After Scrubbing (30 days)
    {
      "data": {
         "id": "pi_abc..."
      }
    }
    ```

2.  **Purging (Deletion)**: After an additional **7 days** (i.e., **37 days** total from receipt), the entire row corresponding to the event is permanently deleted from the `event_buffer` table.

## Implementation

- **`is_scrubbed` Column**: A boolean column `event_buffer.is_scrubbed` tracks whether an event's payload has been anonymized.
- **`scrub_event_buffer` Function**: A PostgreSQL function (`public.scrub_event_buffer(ttl_days int)`) performs the JSON manipulation to remove sensitive data, preserving only `payload.data.id`.
- **`guardian-retention-job` Edge Function**: A Supabase Edge Function that runs automatically on a schedule.
  - It calls the `scrub_event_buffer` function for events older than `EVENT_BUFFER_TTL_DAYS`.
  - It deletes rows from `event_buffer` where `received_at` is older than `EVENT_BUFFER_TTL_DAYS + 7` days.
- **Scheduler**: A Supabase Scheduled Task (or pg_cron job) triggers the `guardian-retention-job` function daily (typically at 4 AM UTC).

## Configuration

- `EVENT_BUFFER_TTL_DAYS`: Environment variable controlling the number of days before scrubbing occurs. Defaults to `30`.

## Rationale

The 30-day scrubbing window allows sufficient time for debugging recent events while minimizing PII exposure. The additional 7-day buffer before purging provides a safety margin and ensures events are scrubbed before deletion.
