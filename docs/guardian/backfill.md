# Guardian Event Backfill

When a new Stripe account is connected to Guardian, historical event data is crucial for the accuracy of rules like velocity checks or bank account swap detection. The Backfill process automatically fetches and ingests recent Stripe events for newly connected accounts.

## How it Works

1.  **Triggering**: Immediately after a successful Stripe Connect OAuth flow (handled in `app/api/stripe/oauth/callback/route.ts`), the system:

    - Creates or updates a record in the `public.backfill_status` table for the connected `stripe_account_id`, setting the `status` to `pending`.
    - Asynchronously calls the `guardian-backfill` Supabase Edge Function, passing the `stripe_account_id`.

2.  **Edge Function (`guardian-backfill`)**: This function executes the core backfill logic:

    - **Status Check**: It first checks the `backfill_status` table. If the status is already `running` or `success`, it exits to prevent duplicates.
    - **Mark as Running**: Sets the status to `running`.
    - **Fetch Events**: Uses the Stripe API (`/v1/events`) with the connected account's context (`Stripe-Account` header) to list events.
      - It fetches events created within the last `BACKFILL_DAYS` (default 90).
      - It uses `limit=100` and `starting_after` for pagination to retrieve all relevant events.
      - It resumes from `last_event_id` stored in `backfill_status` if a previous run was interrupted.
    - **Filter Events**: Filters the fetched events, keeping only those whose types are relevant to Guardian (defined in `lib/guardian/stripeEvents.ts` via `isGuardianSupportedEvent`).
    - **Buffer Events**: Upserts the relevant events into the `public.event_buffer` table in batches (`BACKFILL_BATCH`, default 300). Upserting prevents duplicates if an event was somehow already received.
    - **Trigger Reactor**: For each batch of events successfully inserted into the buffer, it asynchronously calls the `guardian-reactor` function for each `event_buffer_id`.
    - **Update Status**: On successful completion of all pages, it updates the `backfill_status` to `success` and records `completed_at`. If an error occurs during fetching or processing, it updates the status to `error`, stores the `last_error` message, and records `completed_at`.

3.  **Retry Mechanism**: A scheduled job (via `pg_cron`) runs periodically (e.g., every 30 minutes):
    - It finds records in `backfill_status` that are in the `error` state and haven't been updated recently (e.g., older than 2 hours).
    - It resets their `status` back to `pending`.
    - **Note**: This reset _makes them eligible_ for backfill again if the trigger logic (e.g., onboarding, manual retry) is invoked. It doesn't _automatically_ call the edge function itself.

## Configuration

### Environment Variables

The `guardian-backfill` edge function uses the following environment variables:

- **Required**: `STRIPE_API_KEY_PLATFORM`: Your platform's Stripe secret key (e.g., `sk_live_...` or `sk_test_...`). This key needs permission to make API calls on behalf of connected accounts.
- **Optional**:
  - `BACKFILL_DAYS`: Number of past days to fetch events for (default: `90`).
  - `BACKFILL_BATCH`: Number of events to insert into the buffer and trigger the reactor for at a time (default: `300`). Adjust based on reactor function capacity and Stripe API rate limits.

These should be set in your Supabase project's Edge Function settings.

### Database

- The `public.backfill_status` table tracks the state.
- The `pg_cron` extension needs to be enabled for the retry job scheduler.
- The SQL migration `20250426_backfill_status.sql` must be run.
- The SQL command to schedule the retry job (found in G-22 issue description or `tests/backfill.spec.ts` comments) must be run.

## Monitoring & Troubleshooting

- Check the `guardian-backfill` function logs in the Supabase dashboard for detailed execution information and errors.
- Monitor the `public.backfill_status` table to see the progress and status of backfills for different accounts.
- If a backfill fails (`status='error'`), check the `last_error` column for details. The retry job should reset the status to `pending` after a delay.
- Ensure the `STRIPE_API_KEY_PLATFORM` has the necessary permissions.
- Check Stripe API rate limits if errors occur during extensive fetching.
