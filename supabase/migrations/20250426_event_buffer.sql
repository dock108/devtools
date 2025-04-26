-- Create event_buffer table
create table public.event_buffer (
  id                uuid primary key default gen_random_uuid(),
  stripe_event_id   text not null unique,
  stripe_account_id text not null,
  type              text not null,
  received_at       timestamptz default now(),
  payload           jsonb not null
);

-- Create index for efficient querying by account_id and time
create index on public.event_buffer (stripe_account_id, received_at desc);

-- Create purge function with configurable TTL
create or replace procedure purge_old_events()
language plpgsql
as $$
declare
  ttl_days int;
  purged_count int;
begin
  -- Get TTL days from settings or use default (30)
  select coalesce(current_setting('app.event_buffer_ttl_days', true)::int, 30) into ttl_days;
  
  -- Delete events older than TTL
  delete from public.event_buffer
  where received_at < current_timestamp - (ttl_days || ' days')::interval
  returning count(*) into purged_count;
  
  raise notice 'Purged % events older than % days', purged_count, ttl_days;
end;
$$;

-- Schedule hourly purge via pg_cron
select cron.schedule(
  'event_buffer_ttl',
  '0 * * * *',
  $$ call purge_old_events(); $$
);

-- Add RLS policies (default deny)
alter table public.event_buffer enable row level security;

-- Grant access to authenticated users (adjust as needed)
create policy "Only admins can select event_buffer"
  on public.event_buffer for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

create policy "Only platform can insert to event_buffer"
  on public.event_buffer for insert
  to authenticated
  using (auth.jwt() ->> 'role' = 'platform_service'); 