-- Migration: Create get_decrypted_stripe_tokens function
-- Description: Creates a SQL function to decrypt Stripe tokens stored in stripe_accounts.

-- Ensure pgsodium extension is enabled if not already
-- CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

CREATE TYPE public.decrypted_tokens AS (
    refresh_token text,
    access_token text
);

CREATE OR REPLACE FUNCTION public.get_decrypted_stripe_tokens(
    p_stripe_account_id text,
    p_key_id uuid
)
RETURNS public.decrypted_tokens -- Return both tokens
LANGUAGE plpgsql
SECURITY DEFINER -- Run as function owner (postgres) to access pgsodium keys
AS $$
DECLARE
    v_encrypted_refresh_token bytea;
    v_encrypted_access_token bytea;
    v_decrypted_refresh_token text;
    v_decrypted_access_token text;
    v_tokens public.decrypted_tokens;
BEGIN
    -- Fetch the encrypted tokens for the given account ID
    SELECT
        encrypted_refresh_token,
        encrypted_access_token
    INTO
        v_encrypted_refresh_token,
        v_encrypted_access_token
    FROM public.stripe_accounts
    WHERE stripe_account_id = p_stripe_account_id;

    IF v_encrypted_refresh_token IS NULL OR v_encrypted_access_token IS NULL THEN
        -- Handle case where tokens are not found or not set
        -- Consider logging this or returning a specific error/null value
        RAISE EXCEPTION 'Encrypted tokens not found for account %s', p_stripe_account_id;
        -- Or return null: RETURN NULL;
    END IF;

    -- Decrypt the tokens using the provided key ID and the account ID as AAD
    v_decrypted_refresh_token := pgsodium.crypto_aead_det_decrypt(
        message := v_encrypted_refresh_token,
        additional := p_stripe_account_id::bytea,
        key_uuid := p_key_id
    )::text;

    v_decrypted_access_token := pgsodium.crypto_aead_det_decrypt(
        message := v_encrypted_access_token,
        additional := p_stripe_account_id::bytea,
        key_uuid := p_key_id
    )::text;

    -- Populate the return type
    v_tokens.refresh_token := v_decrypted_refresh_token;
    v_tokens.access_token := v_decrypted_access_token;

    RETURN v_tokens;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise or return null/error indicator
        RAISE WARNING 'Error decrypting tokens for account %s: %', p_stripe_account_id, SQLERRM;
        RAISE; -- Re-raise the exception
        -- Or return null: RETURN NULL;
END;
$$;

-- Grant execute permission to the role used by your backend (e.g., service_role)
GRANT EXECUTE ON FUNCTION public.get_decrypted_stripe_tokens(
    text, uuid
) TO service_role;


-- End of migration 