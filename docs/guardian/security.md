# Security Model

## Row-Level Security

Stripe Guardian implements Row-Level Security (RLS) to ensure strict multi-tenant data isolation. All data access is filtered through RLS policies that tie every row to the authenticated user via the `connected_accounts` table.

### Entity Relationship Diagram with RLS Filters

```
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│ auth.users        │       │ connected_accounts │       │ payout_events     │
├───────────────────┤       ├───────────────────┤       ├───────────────────┤
│ id                │<──────┤ user_id           │       │ id                │
│ email             │       │ stripe_account_id │<──────┤ stripe_account_id │   RLS FILTER:
└───────────────────┘       │ business_name     │       │ stripe_event_id   │ ◄──── EXISTS JOIN TO
                            │ webhook_secret    │       │ stripe_payout_id  │      connected_accounts 
                            │ live              │       │ type              │      WHERE user_id = auth.uid() 
                            └───────────────────┘       │ event_data        │
                                                        └───────────────────┘

                                                        ┌───────────────────┐
                                                        │ alerts            │
                                                        ├───────────────────┤
                                                        │ id                │   RLS FILTER:
                                                        │ alert_type        │ ◄──── EXISTS JOIN TO
                                                        │ severity          │      connected_accounts
                                                        │ stripe_account_id │      WHERE user_id = auth.uid()
                                                        │ message           │
                                                        │ resolved          │
                                                        └───────────────────┘

                                                        ┌───────────────────┐
                                                        │pending_notif.     │   RLS FILTER:
                                                        ├───────────────────┤ ◄──── DENY ALL
                                                        │ id                │      (service_role only)
                                                        │ alert_id          │
                                                        │ enqueued_at       │
                                                        └───────────────────┘
```

## RLS Policies Summary

### connected_accounts

- **Owner Access**: Users can only read/write/update accounts where `user_id = auth.uid()`.
- **Service Role Bypass**: Service role can access all accounts for administrative functions.

### payout_events

- **Owner Access**: Users can only view events related to accounts they own via `connected_accounts` join.
- **Service Role Bypass**: Service role can access all events for webhook processing.

### alerts

- **Read Access**: Users can only view alerts for their own accounts via `connected_accounts` join.
- **Update Restrictions**: Users can only update to mark alerts as resolved, cannot edit other fields.
- **Service Role Bypass**: Service role can access all alerts for alert generation and management.

### pending_notifications

- **Deny All**: Regular users have no access to this table.
- **Service Role Only**: Only accessible via service role for notification workers.

## Authentication Flow

1. Users authenticate via Supabase Auth.
2. JWT contains user ID that RLS policies use to filter data with `auth.uid()`.
3. Browser-side client requests respect RLS policies.
4. Edge Functions and server-side code use service role to bypass RLS when needed.

## Service Role Usage

The service role key is only used in controlled contexts:

1. **Webhook Processing**: For inserting events and generating alerts.
2. **Notification Dispatch**: For processing pending notifications.
3. **Admin Functions**: For managing accounts and data across tenants.

Service role functions never expose the key client-side and use minimal required permissions. 