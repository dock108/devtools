-- Event Buffer Migration
-- Run with: supabase db reset && supabase db push

-- Raw Stripe webhook events buffer
create table public.event_buffer (
  id bigint generated always as identity primary key,
  stripe_event_id text not null unique,
  stripe_account_id text not null,
  type text not null,
  payload jsonb not null,
  processed boolean default false,
  received_at timestamptz default now()
);
create index event_buffer_account_idx on public.event_buffer (stripe_account_id);
create index event_buffer_processed_idx on public.event_buffer (processed) where processed = false;
create index event_buffer_type_idx on public.event_buffer (type);

-- Failed reactor dispatch tracking
create table public.failed_event_dispatch (
  id bigint generated always as identity primary key,
  event_buffer_id bigint not null references public.event_buffer(id) on delete cascade,
  endpoint text not null,
  status_code int,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  retries int default 0,
  last_retry_at timestamptz,
  created_at timestamptz default now()
);
create index failed_event_dispatch_event_idx on public.failed_event_dispatch (event_buffer_id);
create index failed_event_dispatch_retries_idx on public.failed_event_dispatch (retries);

-- Add RLS policies
comment on table public.event_buffer is 'Buffer table for raw Stripe webhook events';
comment on table public.failed_event_dispatch is 'Tracks failed reactor dispatches for retry';

-- Create RLS policies
alter table public.event_buffer enable row level security;
alter table public.failed_event_dispatch enable row level security;

-- Policy for account owners to view their own events
create policy "Account owners can view their events"
  on public.event_buffer
  for select
  using (stripe_account_id = auth.jwt() ->> 'account_id');

-- Policy for failed dispatches
create policy "Account owners can view their failed dispatches"
  on public.failed_event_dispatch
  for select
  using (event_buffer_id in (
    select id from public.event_buffer 
    where stripe_account_id = auth.jwt() ->> 'account_id'
  )); 