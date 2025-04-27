-- Migration: Add Stripe Billing fields to settings table
-- G-26: Adds columns to track Stripe customer and subscription IDs.

-- Add columns if they don't exist
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS stripe_customer_id text NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text NULL,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

-- Add check constraint for tier values if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND table_name = 'settings' AND constraint_name = 'settings_tier_check'
    ) THEN
        ALTER TABLE public.settings ADD CONSTRAINT settings_tier_check CHECK (tier IN ('free', 'pro'));
    END IF;
END
$$;

-- Comments for new columns
COMMENT ON COLUMN public.settings.stripe_customer_id IS 'Stripe Customer ID associated with this settings record.';
COMMENT ON COLUMN public.settings.stripe_subscription_id IS 'Stripe Subscription ID for the active Pro plan.';
COMMENT ON COLUMN public.settings.tier IS 'Billing tier for the user (free or pro).';

-- Reminder: Mike, run this manually in SQL Editor post-merge if needed, though ALTER TABLE should be safe. 