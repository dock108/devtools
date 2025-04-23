# Guardian Alert Channels

This document describes the alert channel configuration for Stripe Guardian.

## Overview

Alert channels determine where alert notifications are sent and whether automatic actions like payout pausing are enabled.

## Database Schema

The `alert_channels` table stores configuration for each Stripe account:

| Field               | Type          | Description                                       |
| ------------------- | ------------- | ------------------------------------------------- |
| `account_id`        | `text`        | Primary key, the Stripe account ID                |
| `slack_webhook_url` | `text`        | Optional Slack webhook URL for notifications      |
| `email_to`          | `text`        | Optional email address for notifications          |
| `auto_pause`        | `boolean`     | Whether to automatically pause suspicious payouts |
| `created_at`        | `timestamptz` | Timestamp when record was created                 |

## Security

The table is protected by row-level security policies to ensure each account can only access its own settings:

```sql
create policy "Account owner full access"
  on public.alert_channels
  for all
  using (account_id = auth.jwt() ->> 'account_id');
```

This ensures that even if a client has database access, they can only view or modify their own alert channel settings.

## Default Configuration

When a new account connects via OAuth, a default row is created with:

- No notification channels configured
- `auto_pause` set to `false`

Users can update these settings from the dashboard to enable notifications and automatic actions.

## Usage Example

```typescript
// Fetch current settings for the connected account
const { data: alertChannels } = await supabase
  .from('alert_channels')
  .select('*')
  .eq('account_id', connectedAccountId)
  .single();

// Update settings
await supabase
  .from('alert_channels')
  .update({
    slack_webhook_url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
    auto_pause: true,
  })
  .eq('account_id', connectedAccountId);
```

# Guardian Alerts Dashboard

The Stripe Guardian Alerts Dashboard provides a real-time view of all detected fraud alerts for your connected Stripe accounts. The dashboard allows you to monitor, filter, and manage alerts as they occur.

![Alerts Dashboard](https://www.dock108.ai/images/guardian-alerts-dashboard.png)

## Features

### Real-time Updates

The dashboard uses Supabase Realtime to provide instant updates when new alerts are generated. You'll see new alerts appear within seconds, without needing to refresh the page.

### Alert Filtering

Alerts are organized into two tabs:

- **Unresolved**: Shows all active alerts that require attention
- **Resolved**: Shows alerts that have been addressed and marked as resolved

### Alert Information

Each alert includes:

- **Date and Time**: When the alert was generated
- **Rule Type**: The type of fraud rule that triggered the alert (Velocity, Bank-Swap, Geo-Mismatch)
- **Severity**: Low, Medium, or High - color-coded for quick identification
- **Message**: Detailed description of the alert
- **Payout ID**: The Stripe payout ID affected by the alert

### Automatic Payout Pause

The dashboard includes an "Auto-pause" toggle that allows you to:

1. **Enable automatic payout pausing**: When enabled, Guardian will automatically pause payouts in Stripe when high-severity alerts are triggered
2. **Disable automatic payout pausing**: When disabled, alerts will be displayed but no automatic pausing will occur

## Managing Alerts

### Resolving Alerts

When you've addressed an alert, you can mark it as resolved by clicking the "Resolve" button. This will:

1. Move the alert to the "Resolved" tab
2. Update the alert status in the database
3. Remove it from active monitoring

## Weekly Digest

Guardian sends a weekly "all-clear" digest email to accounts that have had zero unresolved alerts during the previous week. This provides reassurance and visibility into Guardian's monitoring activities.

### Email Content

The weekly digest includes:

- Confirmation that no anomalies were detected during the previous week
- Summary of the total number of payouts that were screened
- Total dollar amount of payouts that were processed safely

### Schedule

The digest emails are sent every Monday at 9:00 AM UTC to eligible accounts with email notifications configured.

### Requirements

To receive the weekly digest:

1. Your account must have no unresolved alerts from the previous Monday to the current Monday
2. You must have an email address configured in your alert channels settings

### Implementation

The weekly digest is implemented as a scheduled task that:

1. Identifies accounts with zero unresolved alerts in the past week
2. Calculates the total payout volume screened during that period
3. Sends a beautifully formatted email with the summary information

### Security

The alerts dashboard is protected by:

- Authentication: Only logged-in users can access the dashboard
- Authorization: Users can only see and manage alerts for their own connected Stripe accounts

## Implementation Notes

The alerts dashboard is built using:

- Next.js App Router
- Supabase for data storage and real-time updates
- Shadcn UI components for the interface
- Tailwind CSS for styling
