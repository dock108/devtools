# Guardian Alert Notifications

Guardian can notify you via email and Slack whenever a new alert is generated, ensuring you're promptly informed about potential issues like fraud, failed payments, or disputes.

## Configuration

Notifications are configured via database settings and environment variables.

### 1. Database Setup (SQL Migrations)

Two SQL migration files set up the necessary database objects:

- `supabase/migrations/20250426_settings.sql`: Creates the `public.settings` table to store notification preferences (tier, email addresses, Slack webhook URL).
- `supabase/migrations/20250426_alert_trigger.sql`: Creates the `public.notify_new_alert()` trigger function and attaches it to the `public.alerts` table. This function calls the `guardian-notify` edge function whenever a new row is inserted into `alerts`.

**Important:** You must run these migrations in your Supabase project's SQL Editor after merging the related code changes.

    ```sql
    -- Apply migrations manually via Supabase SQL Editor
    -- (Paste content of 20250426_settings.sql first)
    -- (Then paste content of 20250426_alert_trigger.sql)
    ```

    Also, ensure the `pg_net` extension is enabled in your Supabase project. The trigger migration includes `create extension if not exists pg_net with schema extensions;`, but verify it was successful.

### 2. Edge Function: `guardian-notify`

This function (`supabase/functions/guardian-notify/index.ts`) is triggered by the database.

- It receives the `alert_id`.
- Fetches the alert details and notification settings.
- Checks tier limits (see below).
- Sends notifications via configured channels.

### 3. Environment Variables

The `guardian-notify` edge function requires the following environment variables to be set in your Supabase project settings:

- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep this secure!).
- `SENDGRID_API_KEY`: Your API key from SendGrid for sending emails.
- `FROM_EMAIL`: The email address notifications will be sent _from_ (e.g., `guardian@yourapp.com` or `alerts@dock108.ai`).

Optional:

- `SLACK_DEFAULT_USERNAME`: Customize the username displayed for Slack messages (defaults to `Guardian`).

**Note:** These variables are logged by the function on cold start to remind you if they are missing.

### 4. Settings Configuration

Currently, notification settings (tier, email recipients, Slack webhook) are managed via a single row in the `public.settings` table seeded by the migration (`20250426_settings.sql`).

- **Email:** Update the `email_to` column with a comma-separated list of recipient addresses.
- **Slack (Pro Tier):** Update the `slack_webhook` column with your Slack Incoming Webhook URL. Ensure the `tier` column is set to `pro`.

_(Future versions may introduce account-specific settings via the application UI.)_

## Notification Channels

- **Email:** Sent via SendGrid to the addresses listed in `settings.email_to`.
- **Slack:** If the account tier is `pro` and `settings.slack_webhook` is configured, a message is posted to the specified Slack channel.

## Tiers and Limits

- **Free Tier:**
  - Notifications: Email only.
  - Limit: Notifications are stopped for a specific Stripe account after **50 alerts** have been processed for that account within a given period (the counter is based on existing alerts in the `alerts` table when a notification is processed). This is intended as a basic usage cap.
- **Pro Tier:**
  - Notifications: Email + Slack (if configured).
  - Limit: No alert volume limits.

## Troubleshooting

- **Notifications not received:**
  - Check the `guardian-notify` edge function logs in your Supabase dashboard for errors (e.g., invalid API keys, network issues, settings not found).
  - Verify the `alerts_notify_tg` trigger is active on the `public.alerts` table.
  - Ensure the `settings` table contains the correct `email_to` and `slack_webhook` URLs.
  - Check your SendGrid account status and API key permissions.
  - Check your Slack Incoming Webhook configuration.
  - For the Free tier, check if the 50-alert limit has been reached for the specific Stripe account.
- **Trigger errors in Postgres logs:** Examine errors related to `pg_net` (ensure it's enabled) or the trigger function itself.
