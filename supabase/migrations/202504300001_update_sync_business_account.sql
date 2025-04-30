-- supabase/migrations/202504300001_update_sync_business_account.sql

-- Function to synchronize Stripe account business details
-- Updates relevant fields in the public.connected_accounts table based on webhook payload
-- Use CREATE OR REPLACE to redefine the function
CREATE OR REPLACE FUNCTION public.sync_business_account(payload jsonb) 
RETURNS void -- Need RETURNS void with CREATE OR REPLACE
AS $$
DECLARE
    target_account_id uuid;
    v_business_name text;
    v_support_phone text;
    v_capabilities jsonb;
BEGIN
    -- Extract the Stripe Account ID from the payload
    target_account_id := (SELECT id FROM public.connected_accounts WHERE stripe_account_id = payload->>'id' LIMIT 1);

    -- Guard clause: Exit if the account doesn't exist in our table
    IF target_account_id IS NULL THEN
        RAISE LOG 'SYNC_BUSINESS_ACCOUNT: Stripe account % not found in public.connected_accounts. Skipping update.', payload->>'id';
        RETURN;
    END IF;

    -- Extract updated fields using new 2024-10 paths with fallbacks/coalesce
    v_business_name := coalesce(payload->>'business_profile_business_name', payload->>'business_name');
    v_support_phone := payload->'business_profile'->>'support_phone';
    
    -- Attempt to extract new capabilities path, default to null if not found
    BEGIN
        v_capabilities := payload->'settings'->'card_payments'->'decline_on';
    EXCEPTION WHEN OTHERS THEN
        v_capabilities := null; -- Handle cases where the path doesn't exist gracefully
        RAISE LOG 'SYNC_BUSINESS_ACCOUNT: Could not extract capabilities from settings->card_payments->decline_on for account %', payload->>'id';
    END;


    -- Update the corresponding row in connected_accounts
    UPDATE public.connected_accounts
    SET 
        business_name = v_business_name,
        support_phone = v_support_phone,
        capabilities = v_capabilities, -- Assuming 'capabilities' column exists and is JSONB type
        last_synced_at = now() -- Update sync timestamp
    WHERE id = target_account_id;

    RAISE LOG 'SYNC OK: Updated business details for account % (Stripe ID: %)', target_account_id, payload->>'id';

EXCEPTION 
    WHEN others THEN
        RAISE EXCEPTION 'SYNC ERROR: Failed to update business details for account %: %', payload->>'id', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Add comment to track function version/change
COMMENT ON FUNCTION public.sync_business_account(jsonb) IS 'v2 - Updated for Stripe 2024-10 API changes and added existence check. April 30 2025.'; 