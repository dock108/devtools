-- Migration: Drop existing settings table
-- G-25: Drops the public.settings table if it exists, to allow recreation with the correct schema.

DROP TABLE IF EXISTS public.settings;

-- Note: This will also implicitly drop constraints, indexes, and triggers associated with the table. 