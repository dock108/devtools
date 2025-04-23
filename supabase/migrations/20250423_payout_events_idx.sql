-- 2025-04-23 – Add composite index for velocity rule performance
-- Adds composite index to improve lookup speed for velocity rules and bulk backfills

do
$$
begin
  -- Only create the index if the payout_events table already exists
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payout_events'
      and c.relkind = 'r'
  ) then
    create index if not exists payout_events_account_created_idx
      on public.payout_events (stripe_account_id, created_at desc);
  end if;
end
$$; 