-- Migration: Add status and rule_set_id to stripe_accounts
-- Description: Adds status tracking and rule set association to connected Stripe accounts.

-- 1. Add Status Column
ALTER TABLE public.stripe_accounts
ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected'));

COMMENT ON COLUMN public.stripe_accounts.status IS 'Connection status of the Stripe account.';
CREATE INDEX idx_stripe_accounts_status ON public.stripe_accounts(status);

-- 2. Add Rule Set Foreign Key Column
-- Assuming a public.rule_sets table exists with id (uuid) and name (text)
ALTER TABLE public.stripe_accounts
ADD COLUMN rule_set_id uuid NULL REFERENCES public.rule_sets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stripe_accounts.rule_set_id IS 'Foreign key linking to the rule set applied to this account (null means default).';
CREATE INDEX idx_stripe_accounts_rule_set_id ON public.stripe_accounts(rule_set_id);

-- 3. Update RLS Policies (Example: Allow Admin to Update rule_set_id)
-- Drop existing generic disallow policy if it prevents specific updates
-- DROP POLICY IF EXISTS "Disallow direct modification by users" ON public.stripe_accounts;

-- Policy: Allow authenticated users to update their own non-sensitive fields (if needed)
-- CREATE POLICY "Allow users to update own accounts (limited)" ON public.stripe_accounts
-- FOR UPDATE TO authenticated
-- USING (auth.uid() = user_id)
-- WITH CHECK (auth.uid() = user_id);
-- -- Consider which columns are updatable by users vs service_role/admins

-- Policy: Allow service_role/backend to update anything
CREATE POLICY "Allow backend full access"
ON public.stripe_accounts
FOR ALL
TO service_role -- Grant access to the backend role
USING (true)
WITH CHECK (true);

-- Policy: Allow specific roles (e.g., 'admin') to update specific fields like rule_set_id or status
-- This requires a helper function to check user roles from JWT
-- Example structure (requires implementing has_app_role function):
-- CREATE POLICY "Allow admins to update rule_set or status" ON public.stripe_accounts
-- FOR UPDATE TO authenticated -- Or specific admin role if using Supabase roles
-- USING (public.has_app_role('admin')) -- Check if user has 'admin' role
-- WITH CHECK (public.has_app_role('admin'));

-- Note: Re-apply the 'Disallow direct modification' policy if needed, ensuring it doesn't block intended updates.

-- End of migration 