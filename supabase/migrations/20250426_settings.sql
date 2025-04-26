-- Migration: Create settings table and seed initial data
-- G-20: Email + Slack Notifications on New Alerts

create table if not exists public.settings (
  id               uuid primary key default gen_random_uuid(),
  tier             text  not null check (tier in ('free', 'pro')),
  email_to         text  not null,      -- comma-sep list
  slack_webhook    text,                -- nullable (free tier may omit)
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

comment on table public.settings is 'Stores account-level notification settings for Guardian.';
comment on column public.settings.tier is 'Subscription tier (free, pro) determining notification features.';
comment on column public.settings.email_to is 'Comma-separated list of email addresses for alert notifications.';
comment on column public.settings.slack_webhook is 'Optional Slack Incoming Webhook URL for Pro tier.';

-- Seed single global row for now (will be replaced by account-specific settings later)
insert into public.settings (tier, email_to)
values ('free', 'alerts@example.com')
on conflict (id) -- Assuming a single global settings row might be updated, or change constraint later
do nothing; 