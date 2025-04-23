# Guardian Alert Channels

This document describes the alert channel configuration for Stripe Guardian.

## Overview

Alert channels determine where alert notifications are sent and whether automatic actions like payout pausing are enabled.

## Database Schema

The `alert_channels` table stores configuration for each Stripe account:

| Field | Type | Description |
|-------|------|-------------|
| `account_id` | `text` | Primary key, the Stripe account ID |
| `slack_webhook_url` | `text` | Optional Slack webhook URL for notifications |
| `email_to` | `text` | Optional email address for notifications |
| `auto_pause` | `boolean` | Whether to automatically pause suspicious payouts |
| `created_at` | `timestamptz` | Timestamp when record was created |

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
    auto_pause: true 
  })
  .eq('account_id', connectedAccountId);
``` 