-- Guardian alert channel settings
create table if not exists public.alert_channels (
  account_id text primary key,                       -- Stripe account id
  slack_webhook_url text,
  email_to text,
  auto_pause boolean default false,
  created_at timestamptz default now()
);

-- Index for quick join with alerts
create index if not exists alert_channels_slack_idx on public.alert_channels(slack_webhook_url);

-- Enable RLS
alter table public.alert_channels enable row level security;

-- Helper: set_config('request.jwt.claim.sub', …) already populated by Supabase auth
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Account owner full access' and tablename = 'alert_channels'
  ) then
    create policy "Account owner full access"
      on public.alert_channels
      for all
      using (account_id = auth.jwt() ->> 'account_id');
  end if;
end
$$;

-- Create admin policy for service role
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Service role full access' and tablename = 'alert_channels'
  ) then
    create policy "Service role full access"
      on public.alert_channels
      for all
      using (auth.role() = 'service_role');
  end if;
end
$$; 