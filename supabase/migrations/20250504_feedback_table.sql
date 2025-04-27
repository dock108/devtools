-- Create the feedback table
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  email text, -- Optional email if user provides it
  message text not null check (length(message) > 0),
  created_at timestamptz default now() not null
);

-- Add indexes
create index idx_feedback_user_id_created_at on public.feedback(user_id, created_at desc);

-- Enable RLS
alter table public.feedback enable row level security;

-- Allow users to insert their own feedback
create policy "Users can insert their own feedback" on public.feedback
  for insert
  with check (auth.uid() = user_id);

-- Allow admins to read all feedback
create policy "Admins can read all feedback" on public.feedback
  for select
  using (auth.role() = 'admin'); -- Assumes you use Supabase's built-in role system via custom claims
  -- Alternative if using metadata: using (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  -- Adjust the role check based on your actual implementation

-- Grant necessary permissions
-- Users need INSERT on the table
grant insert on table public.feedback to authenticated;
-- Admins need SELECT
grant select on table public.feedback to authenticated; -- Granting to authenticated, RLS policy restricts
-- Or grant specifically to a service_role if reading via backend process
-- grant select on table public.feedback to service_role;

-- Ensure sequence permissions for default value (usually handled automatically)
grant usage on schema public to authenticated; 