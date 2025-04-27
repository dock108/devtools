-- Migration: Create upsert_stripe_account function
-- Description: Creates a SQL function to handle inserting or updating stripe_accounts with pgsodium encryption.

-- Ensure pgsodium extension is enabled if not already
-- CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

CREATE OR REPLACE FUNCTION public.upsert_stripe_account(
    p_user_id uuid,
    p_stripe_account_id text,
    p_scope text,
    p_refresh_token text,
    p_access_token text,
    p_key_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Run as the function owner (typically postgres) to access pgsodium keys
AS $$
DECLARE
    v_encrypted_refresh_token bytea;
    v_encrypted_access_token bytea;
BEGIN
    -- Ensure service_role (or the user running this function) has usage on pgsodium schema
    -- GRANT USAGE ON SCHEMA pgsodium TO service_role;

    -- Encrypt the tokens using deterministic AEAD encryption
    -- Note: Deterministic allows searching for duplicates if needed, but has implications if plaintext repeats.
    -- Use crypto_aead_encrypt for non-deterministic if preferred and nonces are handled.
    -- We associate the stripe_account_id as additional authenticated data (AAD) for integrity.
    v_encrypted_refresh_token := pgsodium.crypto_aead_det_encrypt(
        message := p_refresh_token::bytea,
        additional := p_stripe_account_id::bytea, -- AAD
        key_uuid := p_key_id
    );

    v_encrypted_access_token := pgsodium.crypto_aead_det_encrypt(
        message := p_access_token::bytea,
        additional := p_stripe_account_id::bytea, -- AAD
        key_uuid := p_key_id
    );

    -- Perform the upsert
    INSERT INTO public.stripe_accounts (
        user_id,
        stripe_account_id,
        scope,
        encrypted_refresh_token,
        encrypted_access_token
    )
    VALUES (
        p_user_id,
        p_stripe_account_id,
        p_scope,
        v_encrypted_refresh_token,
        v_encrypted_access_token
    )
    ON CONFLICT (stripe_account_id) DO UPDATE SET
        -- Update fields if the account is reconnected
        user_id = EXCLUDED.user_id, -- Ensure user ownership is updated if somehow changed
        scope = EXCLUDED.scope,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        updated_at = now();
END;
$$;

-- Grant execute permission to the role used by your backend (e.g., service_role)
GRANT EXECUTE ON FUNCTION public.upsert_stripe_account(
    uuid, text, text, text, text, uuid
) TO service_role;


-- End of migration 