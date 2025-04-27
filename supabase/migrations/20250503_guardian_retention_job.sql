-- Ensure pg_cron extension is available (should be enabled in Supabase by default)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Set default TTL for event buffer if not already configured (e.g., via Supabase env vars)
do $$
begin
  if current_setting('app.event_buffer_ttl_days', true) is null then
    -- Setting it non-transactionally just in case
    perform set_config('app.event_buffer_ttl_days','30', false);
    raise notice 'app.event_buffer_ttl_days GUC not found, set default to 30';
  else
     raise notice 'app.event_buffer_ttl_days GUC already set to: %', current_setting('app.event_buffer_ttl_days', true);
  end if;
end;
$$;

-- Table to track the last run time of scheduled jobs
create table if not exists public.job_heartbeat (
  job_name text primary key,
  ran_at timestamptz not null,
  -- Optional: Add columns like status ('success', 'failed'), error_message text
);

-- Allow authenticated users to read heartbeat status (adjust RLS as needed)
-- Grant usage on the schema if necessary
-- grant usage on schema public to authenticated;
-- Grant select on the table
-- grant select on table public.job_heartbeat to authenticated;

-- Procedure to purge old data and record heartbeat
create or replace procedure public.guardian_run_retention()
language plpgsql
as $$
declare
  v_ttl_days int;
  v_cutoff_timestamp timestamptz;
  v_rows_deleted int;
begin
  -- Get TTL value, default to 30 if setting is invalid or missing after check
  begin
    v_ttl_days := current_setting('app.event_buffer_ttl_days')::int;
  exception
    when others then
      v_ttl_days := 30;
      raise warning 'Invalid app.event_buffer_ttl_days setting, using default: 30';
  end;

  -- Calculate the cutoff timestamp (TTL + 7 days grace period)
  v_cutoff_timestamp := now() - (v_ttl_days + 7) * interval '1 day';
  raise notice 'Purging data older than: % (TTL: % days + 7 days grace)', v_cutoff_timestamp, v_ttl_days;

  -- Delete from notification_queue
  with deleted as (
    delete from public.notification_queue
    where created_at < v_cutoff_timestamp
    returning id
  )
  select count(*) into v_rows_deleted from deleted;
  raise notice 'Deleted % rows from notification_queue', v_rows_deleted;

  -- Delete from alerts
  with deleted as (
    delete from public.alerts
    where created_at < v_cutoff_timestamp
    returning id
  )
  select count(*) into v_rows_deleted from deleted;
  raise notice 'Deleted % rows from alerts', v_rows_deleted;

  -- Delete from events_raw
  -- Note: Consider potential FK constraints if events_raw is referenced elsewhere
  with deleted as (
    delete from public.events_raw -- Assuming this is the correct table name
    where created_at < v_cutoff_timestamp
    returning id
  )
  select count(*) into v_rows_deleted from deleted;
  raise notice 'Deleted % rows from events_raw', v_rows_deleted;

  -- Upsert heartbeat row upon successful completion
  insert into public.job_heartbeat(job_name, ran_at)
  values ('guardian_retention', now())
  on conflict (job_name) do update
     set ran_at = excluded.ran_at;
  raise notice 'Updated heartbeat for guardian_retention';

exception
  when others then
    raise exception 'Error in guardian_run_retention: %', sqlerrm;
    -- Optional: Update heartbeat with failure status if table includes it
end;
$$;

-- Schedule the job to run nightly at 04:00 UTC
-- The job runs the procedure defined above.
select cron.schedule(
  'guardian_retention_nightly', -- Job name (unique)
  '0 4 * * *', -- Cron schedule: 4 AM UTC daily
  $$
  call public.guardian_run_retention();
  $$
);

-- Optional: Unschedule existing job if name changes or testing
-- select cron.unschedule('guardian_retention');

-- Grant execute permission on the procedure to the postgres user (or the user pg_cron runs as)
-- grant execute on procedure public.guardian_run_retention to postgres; 