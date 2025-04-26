-- 1️⃣  Idempotency table
create table if not exists public.processed_events (
  stripe_event_id text primary key,
  processed_at    timestamptz default now()
);

-- 2️⃣  Uniqueness constraint on alerts
alter table public.alerts
  add constraint alerts_unique_once
  unique (stripe_account_id, alert_type, event_id); 