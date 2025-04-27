-- Migration: Add RLS Policies for Admin UI
-- G-25: Restrict access to rule_sets and settings tables to admin users

-- Ensure RLS is enabled on the tables
alter table public.rule_sets enable row level security;
alter table public.settings enable row level security;

-- Drop existing policies if they exist (optional, but good practice)
-- DROP POLICY IF EXISTS "admins manage rule_sets" ON public.rule_sets;
-- DROP POLICY IF EXISTS "admins manage settings" ON public.settings;

-- Policy for rule_sets: Allow admins full access
create policy "admins manage rule_sets"
  on public.rule_sets
  for all
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- Policy for settings: Allow admins full access
create policy "admins manage settings"
  on public.settings
  for all
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

comment on policy "admins manage rule_sets" on public.rule_sets is 'Allows users with the admin role in their JWT claims to manage rule sets.';
comment on policy "admins manage settings" on public.settings is 'Allows users with the admin role in their JWT claims to manage global settings.';

-- Enable RLS on the accounts table
alter table public.accounts enable row level security;

-- Policy for accounts: Allow admins to view all accounts
create policy "admins view accounts"
  on public.accounts
  for select
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

-- Policy for accounts: Allow admins to update accounts (specifically rule_set_id, status, etc.)
-- Be specific about which columns can be updated if necessary.
create policy "admins update accounts"
  on public.accounts
  for update
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

comment on policy "admins view accounts" on public.accounts is 'Allows users with the admin role to view all connected accounts.';
comment on policy "admins update accounts" on public.accounts is 'Allows users with the admin role to update account details like rule set assignment.';

-- IMPORTANT: Remember to run this migration manually in the Supabase SQL Editor after merging. 