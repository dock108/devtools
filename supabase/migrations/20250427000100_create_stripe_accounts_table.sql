-- Migration: Create stripe_accounts table
-- Description: Stores Stripe Connect account details linked to users, including encrypted tokens.

-- Ensure pgsodium is available
-- CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

-- 1. Create the table
CREATE TABLE public.stripe_accounts (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_account_id text NOT NULL UNIQUE, -- Stripe Account ID (e.g., acct_...)
    scope text NULL, -- Store the scope granted during OAuth
    encrypted_refresh_token bytea NULL, -- Encrypted using pgsodium
    encrypted_access_token bytea NULL, -- Encrypted using pgsodium
    -- Add other relevant fields if needed (e.g., livemode, display_name from Stripe)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add Comments
COMMENT ON TABLE public.stripe_accounts IS 'Stores Stripe Connect account details linked to users.';
COMMENT ON COLUMN public.stripe_accounts.user_id IS 'Reference to the application user.';
COMMENT ON COLUMN public.stripe_accounts.stripe_account_id IS 'The unique Stripe Connect account ID.';
COMMENT ON COLUMN public.stripe_accounts.scope IS 'OAuth scope granted by the user.';
COMMENT ON COLUMN public.stripe_accounts.encrypted_refresh_token IS 'Stripe refresh token, encrypted using pgsodium.';
COMMENT ON COLUMN public.stripe_accounts.encrypted_access_token IS 'Stripe access token, encrypted using pgsodium.';

-- 3. Create Indexes
CREATE INDEX idx_stripe_accounts_user_id ON public.stripe_accounts(user_id);
CREATE INDEX idx_stripe_accounts_stripe_account_id ON public.stripe_accounts(stripe_account_id);

-- 4. Add placeholder for Key ID (MUST BE SET IN Supabase Vault/Secrets)
-- Replace 'key_id_goes_here' with the actual UUID of the pgsodium key
-- GRANT USAGE ON SCHEMA pgsodium TO service_role; -- Ensure service role can use pgsodium
-- SECURITY LABEL FOR pgsodium ON COLUMN public.stripe_accounts.encrypted_refresh_token IS 'ENCRYPT WITH KEY ID key_id_goes_here NONCE \'\0\0\0\0\0\0\0\0\0\0\0\0\'';
-- SECURITY LABEL FOR pgsodium ON COLUMN public.stripe_accounts.encrypted_access_token IS 'ENCRYPT WITH KEY ID key_id_goes_here NONCE \'\0\0\0\0\0\0\0\0\0\0\0\0\'';
-- Note: Using a fixed zero nonce assumes deterministic encryption is acceptable or
-- nonces will be handled/stored separately. Consider implications carefully.
-- Alternatively, use non-deterministic encryption if nonces aren't stored/derived.

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Policy: Allow authenticated users to read their own account links.
CREATE POLICY "Allow authenticated users SELECT own accounts"
ON public.stripe_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Prevent users from inserting/updating/deleting directly.
-- These operations should be handled by the backend (service_role) via the API route.
CREATE POLICY "Disallow direct modification by users"
ON public.stripe_accounts
FOR ALL
TO public
USING (false);

-- 7. Apply the updated_at trigger function (assuming it exists from previous migration)
CREATE TRIGGER on_stripe_accounts_updated
BEFORE UPDATE ON public.stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- End of migration 