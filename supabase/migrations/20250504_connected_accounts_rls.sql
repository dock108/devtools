-- 1️⃣ Add missing columns
alter table public.connected_accounts
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists webhook_secret text,
  add column if not exists live boolean default false;

-- 2️⃣ Primary key & index tweaks
alter table public.connected_accounts
  drop constraint if exists connected_accounts_pkey,
  add primary key (stripe_account_id);

create index if not exists connected_accounts_user_idx on public.connected_accounts(user_id);

-- 3️⃣ Enable RLS & policies
alter table public.connected_accounts enable row level security;

create policy "Owner can read / write own account"
  on public.connected_accounts
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role can bypass RLS
create policy "Service role unrestricted"
  on public.connected_accounts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role'); 