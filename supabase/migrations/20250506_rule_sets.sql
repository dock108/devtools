alter table public.connected_accounts
  add column if not exists rule_set jsonb default '{}'::jsonb;

-- Make sure RLS policy from connected_accounts already covers the new column.
-- Since rule_set is a new column on an existing table, 
-- it will be automatically covered by existing RLS policies. 