-- Migration: Create accounts table (or alter if exists)
-- G-25: Defines the table for connected Stripe accounts and adds rule_set_id FK.

-- Re-use trigger function if it exists, otherwise create it.
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table Definition (Use CREATE or ALTER depending on your state)
-- Option 1: Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to the user who connected it
    stripe_account_id text NOT NULL UNIQUE,     -- The Stripe Connect Account ID (acct_...)
    account_name text NULL,                     -- Optional friendly name for the account
    status text NOT NULL DEFAULT 'pending',      -- e.g., 'pending', 'active', 'inactive', 'restricted'
    rule_set_id uuid NULL,                      -- Foreign key to the assigned rule set
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Foreign Key Constraint (explicitly named)
    CONSTRAINT fk_accounts_rule_set
        FOREIGN KEY(rule_set_id) 
        REFERENCES public.rule_sets(id)
        ON DELETE SET NULL -- If a rule set is deleted, revert account to using default behavior (null)
);

-- Option 2: If table exists, ensure rule_set_id column and FK exist
-- Uncomment and adapt these lines if you already have an 'accounts' table.
/*
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='accounts' AND column_name='rule_set_id') THEN
        ALTER TABLE public.accounts ADD COLUMN rule_set_id uuid NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_schema='public' AND table_name='accounts' AND constraint_name='fk_accounts_rule_set') THEN
        ALTER TABLE public.accounts 
        ADD CONSTRAINT fk_accounts_rule_set
            FOREIGN KEY(rule_set_id) 
            REFERENCES public.rule_sets(id)
            ON DELETE SET NULL;
    END IF;
    
    -- Also ensure updated_at column exists if needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='accounts' AND column_name='updated_at') THEN
        ALTER TABLE public.accounts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    END IF;
END
$$;
*/

COMMENT ON TABLE public.accounts IS 'Stores information about connected Stripe accounts.';
COMMENT ON COLUMN public.accounts.id IS 'Unique identifier for the account record in our DB.';
COMMENT ON COLUMN public.accounts.user_id IS 'The user who connected this Stripe account.';
COMMENT ON COLUMN public.accounts.stripe_account_id IS 'The actual Stripe Connect Account ID (acct_...). Must be unique.';
COMMENT ON COLUMN public.accounts.account_name IS 'An optional, user-provided name for easier identification.';
COMMENT ON COLUMN public.accounts.status IS 'Current status of the connected account (e.g., active, pending).';
COMMENT ON COLUMN public.accounts.rule_set_id IS 'Foreign key referencing the rule_set applied to this account. Null means default rules.';
COMMENT ON COLUMN public.accounts.created_at IS 'Timestamp when the account was connected.';
COMMENT ON COLUMN public.accounts.updated_at IS 'Timestamp when the account record was last updated.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_account_id ON public.accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_rule_set_id ON public.accounts(rule_set_id);

-- Trigger for updated_at (Create only if it doesn't already exist on the table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.accounts'::regclass
        AND tgname = 'set_accounts_timestamp'
    ) THEN
        CREATE TRIGGER set_accounts_timestamp
        BEFORE UPDATE ON public.accounts
        FOR EACH ROW
        EXECUTE FUNCTION public.trigger_set_timestamp();
    END IF;
END
$$; 