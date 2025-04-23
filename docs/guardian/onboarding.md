# Stripe Guardian Onboarding Guide

## Database Schema

### Connected Accounts Table

The `public.connected_accounts` table stores information about Stripe Connect accounts linked to your platform:

| Column | Type | Description |
|--------|------|-------------|
| stripe_account_id | text | Primary key: Stripe Account ID (e.g., `acct_123XYZ`) |
| user_id | uuid | Foreign key to auth.users(id): The owner of this account |
| business_name | text | Display name of the business |
| status | text | Account status (e.g., 'active', 'paused', 'disconnected') |
| webhook_secret | text | Secret used to verify webhooks from this account |
| live | boolean | Whether this is a live account (false = test mode) |
| metadata | jsonb | Additional metadata about the account |
| created_at | timestamptz | When the account was connected |

### Entity Relationship Diagram

```
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│ auth.users        │       │ connected_accounts │       │ alerts            │
├───────────────────┤       ├───────────────────┤       ├───────────────────┤
│ id                │<──────┤ user_id           │       │ id                │
│ email             │       │ stripe_account_id │<──────┤ stripe_account_id │
│ created_at        │       │ business_name     │       │ alert_type        │
└───────────────────┘       │ status            │       │ severity          │
                            │ webhook_secret    │       │ message           │
                            │ live              │       │ stripe_payout_id  │
                            │ metadata          │       │ event_id          │
                            │ created_at        │       │ resolved          │
                            └───────────────────┘       │ created_at        │
                                                        └───────────────────┘
```

## Row-Level Security (RLS)

The `connected_accounts` table uses Row-Level Security to ensure users can only access their own connected accounts:

1. Each user can only read or write accounts where `user_id = auth.uid()` (current user's ID)
2. Service role functions can bypass RLS for administrative tasks

## Onboarding Process

The onboarding flow typically consists of these steps:

1. Initialize OAuth with Stripe Connect
2. Redirect user to Stripe Connect authorization page
3. Process callback from Stripe Connect
4. Store account credentials in the `connected_accounts` table
5. Register webhooks for the connected account
6. Redirect to dashboard

This table structure supports both Standard and Express Connect account types. 