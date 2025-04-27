-- Migration: Create backfill_status table
-- G-22: Back-Fill Last 90 Days of Stripe Events

create table if not exists public.backfill_status (
  stripe_account_id text primary key references public.connected_accounts(stripe_account_id) on delete cascade,
  started_at        timestamptz default now() not null,
  completed_at      timestamptz,
  status            text check (status in ('pending','running','success','error')) default 'pending' not null,
  last_error        text,
  last_event_id     text, -- Store the ID of the last event fetched in the previous run (for pagination resuming)
  updated_at        timestamptz default now() not null
);

-- Trigger to automatically update updated_at timestamp
create or replace function public.set_current_timestamp_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_backfill_status_updated_at on public.backfill_status; -- Drop existing if necessary
create trigger set_backfill_status_updated_at
before update on public.backfill_status
for each row execute function public.set_current_timestamp_updated_at();

comment on table public.backfill_status is 'Tracks the status of historical Stripe event backfill for newly connected accounts.';
comment on column public.backfill_status.stripe_account_id is 'The Stripe Connect account ID being backfilled.';
comment on column public.backfill_status.started_at is 'Timestamp when the backfill process was first initiated for this account.';
comment on column public.backfill_status.completed_at is 'Timestamp when the backfill process successfully completed or terminally failed.';
comment on column public.backfill_status.status is 'Current status of the backfill process (pending, running, success, error).';
comment on column public.backfill_status.last_error is 'Stores the error message if the last attempt failed.';
comment on column public.backfill_status.last_event_id is 'ID of the last event processed in the previous successful page fetch, used for pagination.';
comment on column public.backfill_status.updated_at is 'Timestamp when the status record was last updated.';

-- Index for quickly finding pending/error jobs
create index if not exists backfill_status_status_idx on public.backfill_status(status); 