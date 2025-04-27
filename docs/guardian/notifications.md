# Guardian Notifications

This document describes how Stripe Guardian alerts are delivered via different channels.

## Channels

- **Email:** Sent via Resend.
- **Slack:** Sent via Incoming Webhooks.

## Configuration

### Environment Variables

The following environment variables are required in `.env.local`:

- `RESEND_API_KEY`: Your Resend API key for sending emails.
- `SLACK_WEBHOOK_URL_DEFAULT` (Optional): A default Slack incoming webhook URL to use if a user hasn't configured their own.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: For Supabase access.
- `STRIPE_SECRET_KEY`: For potential Stripe API interactions (e.g., auto-pause).
- `NEXT_PUBLIC_APP_URL`: The base URL for links included in notifications.

### User Preferences

Notification channels and destinations are configured per-user in the `user_notification_channels` table. This includes:

- `user_id`: The ID of the user.
- `email_enabled`: Boolean flag to enable/disable email notifications.
- `email_to` (Potentially): The email address to send to (might come from user profile instead).
- `slack_enabled`: Boolean flag to enable/disable Slack notifications.
- `slack_webhook_url`: The specific Slack incoming webhook URL for the user.

## Delivery Mechanism

1.  When an alert is generated, a trigger inserts a job into a notification queue table (e.g., `notifications`).
2.  Scheduled Supabase functions (`send-email-alert`, `send-slack-alert`) periodically poll this queue.
3.  The functions retrieve job details, fetch user preferences, render templates, and attempt delivery.

## Retry Logic

- **Email (Resend):** Retries up to 3 times for 5xx or 429 errors with exponential backoff (1s, 4s, 9s + jitter).
- **Slack:** Retries once after 1 minute for any delivery failure (status >= 400).

## Delivery Status

The `delivery_status` column (JSONB) on the `alerts` table tracks the outcome for each channel:

- `{"email": "delivered", "slack": "failed"}`
- `{"email": "not_configured", "slack": "delivered"}`

Possible statuses:

- `delivered`: Successfully sent.
- `failed`: Failed after all retry attempts.
- `not_configured`: Channel was disabled or no destination (email/webhook) was set for the user.
- `retrying` (Potentially): Status might be set in the queue table while retries are pending.

This status is displayed in the alert detail UI.

## Monitoring & Troubleshooting

- Check the logs for the `send-email-alert` and `send-slack-alert` Supabase functions.
- Examine the `alerts.delivery_status` column.
- Inspect the notification queue table for pending or failed jobs.
