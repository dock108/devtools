-- Queue table for notifications
BEGIN;

create table if not exists public.notification_queue (
  id                   bigserial primary key,
  alert_id             bigint references public.alerts(id) on delete cascade not null,
  channel              text check (channel in ('email','slack')) not null,
  attempt              int not null default 0,
  max_attempts         int not null default 3,
  status               text not null default 'queued',          -- queued | processing | sent | failed
  last_attempt_at      timestamptz,
  next_attempt_at      timestamptz not null default now(),
  error_msg            text,
  created_at           timestamptz not null default now(),

  -- Ensure alert_id is not null
  constraint notification_queue_alert_id_check check (alert_id is not null)
);

-- Simple index to pull the next job efficiently
create index if not exists notification_queue_next_attempt_idx
  on public.notification_queue (status, next_attempt_at)
  where status = 'queued';

-- Add comments
COMMENT ON TABLE public.notification_queue IS 'Queue for pending alert notifications (email, slack).';
COMMENT ON COLUMN public.notification_queue.alert_id IS 'FK to the alert that needs notification.';
COMMENT ON COLUMN public.notification_queue.channel IS 'The notification channel (email or slack).';
COMMENT ON COLUMN public.notification_queue.attempt IS 'Current delivery attempt number.';
COMMENT ON COLUMN public.notification_queue.max_attempts IS 'Maximum number of delivery attempts for this job.';
COMMENT ON COLUMN public.notification_queue.status IS 'Current status: queued, processing, sent, failed.';
COMMENT ON COLUMN public.notification_queue.last_attempt_at IS 'Timestamp of the last delivery attempt.';
COMMENT ON COLUMN public.notification_queue.next_attempt_at IS 'Timestamp when the next attempt should be made (for retries).';
COMMENT ON COLUMN public.notification_queue.error_msg IS 'Error message from the last failed attempt.';

-- Enqueue one record
create or replace function public.enqueue_notification(
  p_alert_id bigint,
  p_channel text,
  p_max_attempts int default 3
) returns void as $$
begin
  -- Only insert if the alert exists and is not null
  if exists (select 1 from public.alerts where id = p_alert_id) then
    insert into public.notification_queue(alert_id, channel, max_attempts)
    values (p_alert_id, p_channel, p_max_attempts)
    on conflict do nothing; -- Avoid duplicates if trigger fires multiple times?
  else
     raise warning 'enqueue_notification: alert_id % does not exist, skipping enqueue.', p_alert_id;
  end if;
end;
$$ language plpgsql security definer;

-- Fetch next batch (for worker)
-- Locks rows being processed using FOR UPDATE SKIP LOCKED
create or replace function public.fetch_notification_batch(
  p_limit int default 50
) returns setof public.notification_queue as $$
declare
  batch_ids bigint[];
begin
  -- Select and lock a batch of queued jobs
  select array_agg(id)
  into batch_ids
  from public.notification_queue
  where status = 'queued'
    and next_attempt_at <= now()
  order by next_attempt_at
  limit p_limit
  for update skip locked;

  if batch_ids is null or array_length(batch_ids, 1) = 0 then
    return;
  end if;

  -- Update the status of the locked rows to 'processing' and increment attempt count
  return query
    update public.notification_queue
       set status = 'processing',
           last_attempt_at = now(),
           attempt = attempt + 1
     where id = any(batch_ids)
    returning *;
end;
$$ language plpgsql security definer;

COMMIT; 