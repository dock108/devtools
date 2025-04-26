-- Migration: Create alert_reads table for tracking viewed alerts
-- G-17: Real-Time Alert Badge & Toast in Dashboard

create table if not exists public.alert_reads (
  user_id   uuid not null references auth.users(id) on delete cascade, -- Ensure reads are cleaned up if user is deleted
  alert_id  bigint not null references public.alerts(id) on delete cascade, -- Ensure reads are cleaned up if alert is deleted
  read_at   timestamptz default now() not null,
  primary key (user_id, alert_id) -- Each user can read each alert only once
);

-- Optional: Index for potentially querying reads by alert or user separately, if needed later
-- create index if not exists alert_reads_user_id_idx on public.alert_reads(user_id);
-- create index if not exists alert_reads_alert_id_idx on public.alert_reads(alert_id);

comment on table public.alert_reads is 'Tracks which user has marked which alert as read.';
comment on column public.alert_reads.user_id is 'The user who read the alert.';
comment on column public.alert_reads.alert_id is 'The alert that was read (references alerts.id which is bigint).';
comment on column public.alert_reads.read_at is 'Timestamp when the alert was marked as read.'; 