-- accounts_without_alerts since timestamp
-- This function returns all alert_channels for accounts that have no unresolved alerts
-- since the given timestamp
create or replace function accounts_without_alerts(since timestamptz)
returns setof alert_channels
language sql as $$
  select ac.*
  from alert_channels ac
  left join alerts a on 
    a.stripe_account_id = ac.account_id and 
    a.resolved = false and
    a.created_at >= since
  where a.id is null
  and ac.email_to is not null; -- Only return accounts with email configured
$$;

-- Index to speed up query
create index if not exists alerts_resolved_idx on alerts(resolved, created_at);

-- Allow execution of the function
grant execute on function accounts_without_alerts to public; 