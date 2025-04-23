----------------------------------------------------------------------
-- 1️⃣ payout_events (already has stripe_account_id)
----------------------------------------------------------------------
alter table public.payout_events enable row level security;

create policy "Owner can read/write payouts"
  on public.payout_events
  for all
  using (
    exists (
      select 1
      from public.connected_accounts ca
      where ca.stripe_account_id = payout_events.stripe_account_id
        and ca.user_id = auth.uid()
    )
  )
  with check (true);  -- inserts happen via service role only

-- Service role bypass for API endpoints
create policy "Service role unrestricted for payouts"
  on public.payout_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

----------------------------------------------------------------------
-- 2️⃣ alerts
----------------------------------------------------------------------
alter table public.alerts enable row level security;

create policy "Owner can select alerts"
  on public.alerts
  for select
  using (
    exists (
      select 1 from public.connected_accounts ca
      where ca.stripe_account_id = alerts.stripe_account_id
        and ca.user_id = auth.uid()
    )
  );

create policy "Owner resolves own alerts"
  on public.alerts
  for update
  using  (exists (select 1 from public.connected_accounts ca
                  where ca.stripe_account_id = alerts.stripe_account_id
                    and ca.user_id = auth.uid())
         )
  with check (resolved = true);

-- Service role bypass for webhooks and alert dispatchers
create policy "Service role unrestricted for alerts"
  on public.alerts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

----------------------------------------------------------------------
-- 3️⃣ pending_notifications (service role only)
----------------------------------------------------------------------
alter table public.pending_notifications enable row level security;
create policy "deny all" on public.pending_notifications for all using (false);

-- Service role bypass for notification workers
create policy "Service role can manage notifications"
  on public.pending_notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role'); 