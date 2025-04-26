-- 1️⃣  Add 'scrubbed' flag so we don't re-scrub the same rows
alter table public.event_buffer
  add column if not exists is_scrubbed boolean default false;

-- 2️⃣  Optional: move PII we want to keep (e.g. last4) into breakout cols
-- skip for now; we'll just redact in JSON

-- 3️⃣ Postgres function to scrub JSON
create or replace function public.scrub_event_buffer(ttl_days int)
returns void language plpgsql as $$
begin
  update public.event_buffer
  set payload     = payload - 'data'  -- strip whole data object
                  || jsonb_build_object('data', jsonb_build_object('id', payload->'data'->>'id')),
      is_scrubbed = true
  where received_at < current_timestamp - (ttl_days || ' days')::interval
    and is_scrubbed = false;
end;
$$; 