-- Recent events by account + time
create index if not exists event_buffer_acct_time_idx
  on public.event_buffer (stripe_account_id, received_at desc);

-- Recent payouts by account + time (if still used directly)
create index if not exists payout_events_acct_time_idx
  on public.payout_events (stripe_account_id, created_at desc);

-- Recent alerts by account + time
create index if not exists alerts_acct_time_idx
  on public.alerts (stripe_account_id, created_at desc);

-- Add comment to track intent of these indexes
comment on index public.event_buffer_acct_time_idx is 'Optimizes rule evaluation queries that filter by account and sort by time';
comment on index public.payout_events_acct_time_idx is 'Speeds up recent payout lookups for velocity breach detection';
comment on index public.alerts_acct_time_idx is 'Improves dashboard performance when filtering alerts by account'; 