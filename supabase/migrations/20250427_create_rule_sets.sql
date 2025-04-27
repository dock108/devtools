-- Migration: Create rule_sets table
-- G-25: Defines the table for storing different rule configurations.

CREATE TABLE public.rule_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rule_sets IS 'Stores different named configurations for Guardian rules.';
COMMENT ON COLUMN public.rule_sets.id IS 'Unique identifier for the rule set.';
COMMENT ON COLUMN public.rule_sets.name IS 'User-defined name for the rule set (e.g., ''Default'', ''High Risk''). Must be unique.';
COMMENT ON COLUMN public.rule_sets.config IS 'JSONB object containing the specific rule configurations (thresholds, windows, etc.).';
COMMENT ON COLUMN public.rule_sets.created_at IS 'Timestamp when the rule set was created.';

-- Create index on name for faster lookups
CREATE INDEX idx_rule_sets_name ON public.rule_sets(name);

-- Insert a default rule set (optional, but often useful)
INSERT INTO public.rule_sets (name, config)
VALUES ('default', '{ "velocityBreach": { "maxPayouts": 5, "windowSeconds": 3600 }, "bankSwap": { "minPayoutUsd": 1000, "lookbackMinutes": 60 } }'::jsonb)
ON CONFLICT (name) DO NOTHING; 