-- Migration: Create account_backfill_status table
-- Description: Stores the status and progress of historical Stripe event back-fills for connected accounts.

-- 1. Create status enum type (optional but recommended)
-- Note: Using TEXT with CHECK constraint for simplicity in this example.
-- CREATE TYPE public.backfill_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- 2. Create the table
CREATE TABLE public.account_backfill_status (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id text NOT NULL UNIQUE, -- Stripe Account ID (e.g., acct_...)
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to the user who owns the account
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    error_message text NULL, -- Store error details if status is 'failed'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add Comments to columns
COMMENT ON COLUMN public.account_backfill_status.account_id IS 'Stripe Account ID (e.g., acct_...).';
COMMENT ON COLUMN public.account_backfill_status.user_id IS 'Link to the user who owns the account.';
COMMENT ON COLUMN public.account_backfill_status.status IS 'Current status of the back-fill job.';
COMMENT ON COLUMN public.account_backfill_status.progress IS 'Back-fill progress percentage (0-100).';
COMMENT ON COLUMN public.account_backfill_status.error_message IS 'Stores error details if status is ''failed''.';

-- 4. Create Indexes
CREATE INDEX idx_account_backfill_status_account_id ON public.account_backfill_status(account_id);
CREATE INDEX idx_account_backfill_status_user_id ON public.account_backfill_status(user_id);
CREATE INDEX idx_account_backfill_status_status ON public.account_backfill_status(status); -- Index status for potential filtering

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.account_backfill_status ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Policy: Allow authenticated users to read their own backfill status records.
CREATE POLICY "Allow authenticated users SELECT own status"
ON public.account_backfill_status
FOR SELECT
TO authenticated -- Grant access to any logged-in user
USING (auth.uid() = user_id);

-- Note: INSERT, UPDATE, DELETE operations should be handled by backend roles (service_role)
-- or potentially via security definer functions if needed, not directly by users.

-- 7. Set up trigger to auto-update updated_at timestamp
-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Use SECURITY DEFINER if needed based on trigger context

-- Apply the trigger to the table
CREATE TRIGGER on_account_backfill_status_updated
BEFORE UPDATE ON public.account_backfill_status
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. Enable Realtime (optional, if UI needs live updates without polling)
-- Note: Requires enabling realtime via Supabase dashboard or config as well.
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_backfill_status;

-- Grant usage on the schema to the supabase_realtime role
-- grant usage on schema public to supabase_realtime;
-- Grant select permission to the supabase_realtime role
-- grant select on public.account_backfill_status to supabase_realtime;


-- End of migration 