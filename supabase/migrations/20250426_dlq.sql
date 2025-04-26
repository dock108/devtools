create table if not exists public.failed_event_dispatch (
  id                uuid primary key default gen_random_uuid(),
  event_buffer_id   uuid,
  stripe_event_id   text not null unique,
  stripe_account_id text,
  type              text,
  received_at       timestamptz,
  payload           jsonb not null,

  last_error        text not null,
  retry_count       int  default 0,
  next_attempt_at   timestamptz default (current_timestamp + interval '5 minutes')
);
create index on public.failed_event_dispatch (next_attempt_at);
create index if not exists failed_event_dispatch_buffer_id_idx on public.failed_event_dispatch (event_buffer_id); 