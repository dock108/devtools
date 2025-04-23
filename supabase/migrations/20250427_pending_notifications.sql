-- Queue table for alert notifications
create table if not exists public.pending_notifications (
  id bigint generated always as identity primary key,
  alert_id bigint references public.alerts(id) on delete cascade,
  enqueued_at timestamptz default now()
);
create index if not exists pending_notifications_enqueued_idx
  on public.pending_notifications(enqueued_at);

-- Trigger to enqueue on every new alert
create or replace function public.enqueue_notification()
returns trigger as $$
begin
  insert into public.pending_notifications(alert_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists alert_enqueue on public.alerts;
create trigger alert_enqueue
  after insert on public.alerts
  for each row execute procedure public.enqueue_notification();

-- Queue pop helper function
create or replace function pop_notification()
returns table (alert_id bigint)
language plpgsql as $$
begin
  delete from public.pending_notifications
  where ctid in (
    select ctid from public.pending_notifications
    order by enqueued_at
    limit 1
    for update skip locked
  )
  returning alert_id into alert_id;
  return;
end;
$$;

-- Pending notifications are processed by service role functions only; set RLS to deny all
alter table public.pending_notifications enable row level security;

-- Apply RLS policy if it doesn't exist yet
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'deny_all' and tablename = 'pending_notifications'
  ) then
    create policy deny_all on public.pending_notifications for all using (false);
  end if;
end
$$; 