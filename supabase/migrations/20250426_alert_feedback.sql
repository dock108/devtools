-- Migration: Create alert_feedback table
-- G-23: Allow users to mark alerts as False Positive/Legit

create table if not exists public.alert_feedback (
  id         uuid primary key default gen_random_uuid(),
  alert_id   bigint references public.alerts(id) on delete cascade not null, -- Changed type to bigint to match alerts.id
  user_id    uuid references auth.users(id) on delete set null, -- Keep feedback even if user is deleted?
  verdict    text not null check (verdict in ('false_positive','legit')),
  comment    text, -- Optional comment, perhaps mainly for false positives
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique (alert_id, user_id)  -- Enforce one vote per user per alert
);

-- Index for quickly fetching feedback for an alert
create index if not exists alert_feedback_alert_id_idx on public.alert_feedback(alert_id);

-- Trigger to automatically update updated_at timestamp
create or replace function public.set_current_timestamp_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply the trigger to the new table
drop trigger if exists set_alert_feedback_updated_at on public.alert_feedback;
create trigger set_alert_feedback_updated_at
before update on public.alert_feedback
for each row execute function public.set_current_timestamp_updated_at();


comment on table public.alert_feedback is 'Stores user feedback (False Positive/Legit) on generated alerts.';
comment on column public.alert_feedback.alert_id is 'The alert being reviewed (references alerts.id which is bigint).';
comment on column public.alert_feedback.user_id is 'The user providing the feedback.';
comment on column public.alert_feedback.verdict is 'User classification: ''false_positive'' or ''legit''.';
comment on column public.alert_feedback.comment is 'Optional user comment, especially for false positives.';
comment on constraint alert_feedback_alert_id_user_id_key on public.alert_feedback is 'Ensures a user can only provide one piece of feedback per alert.';

-- IMPORTANT: Remember to run this migration manually in the Supabase SQL Editor after merging. 