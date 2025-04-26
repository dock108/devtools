-- 1️⃣  rule_sets master table
create table if not exists public.rule_sets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique, -- Ensure names like 'default' are unique
  -- JSON column holding thresholds by rule key
  config        jsonb not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Function to update updated_at timestamp
create or replace function trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for rule_sets table
create trigger set_timestamp
before update on public.rule_sets
for each row
execute procedure trigger_set_timestamp();

-- Insert a "default" set that matches today's hard-coded values
-- Using specific keys matching the structure in lib/guardian/rules/edge.ts defaultConfig
insert into public.rule_sets (name, config)
values ('default', '{
  "velocityBreach": { "maxPayouts": 3, "windowSeconds": 60 },
  "bankSwap": { "lookbackMinutes": 5, "minPayoutUsd": 1000 },
  "geoMismatch": { "mismatchChargeCount": 2 },
  "failedChargeBurst": { "minFailedCount": 3, "windowMinutes": 5 },
  "suddenPayoutDisable": { "enabled": true },
  "highRiskReview": { "enabled": true }
}'::jsonb)
on conflict (name) do update set
  config = excluded.config,
  updated_at = now(); -- Update timestamp if default changes

-- 2️⃣  Connect each Stripe account to a rule_set (nullable falls back to default)
alter table public.connected_accounts
  add column if not exists rule_set_id uuid references public.rule_sets(id) on delete set null;

-- Update existing accounts without a rule_set_id to point to the default set
-- This ensures existing accounts get the default behavior
do $$
declare
  default_set_id uuid;
begin
  select id into default_set_id from public.rule_sets where name = 'default';
  if found then
    update public.connected_accounts
    set rule_set_id = default_set_id
    where rule_set_id is null;
  end if;
end $$;

-- Add an index for faster lookups
create index if not exists connected_accounts_rule_set_id_idx on public.connected_accounts(rule_set_id); 