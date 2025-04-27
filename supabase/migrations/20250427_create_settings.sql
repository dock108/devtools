-- Migration: Create settings table
-- G-25: Defines the table for storing global notification settings.

-- Function to update updated_at timestamp (safe to run multiple times)
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table Definition (Create only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.settings (
    id text PRIMARY KEY DEFAULT 'global_settings',
    slack_webhook_url text NULL,
    notification_emails text[] NULL,
    slack_notifications_enabled boolean NOT NULL DEFAULT false,
    email_notifications_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Clean up any invalid rows before adding the constraint
DELETE FROM public.settings WHERE id::text != 'global_settings';

-- Ensure the correct row exists (idempotent)
INSERT INTO public.settings (id) VALUES ('global_settings') ON CONFLICT (id) DO NOTHING;

-- Add constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND table_name = 'settings' AND constraint_name = 'settings_id_check'
    ) THEN
        -- Explicitly cast id to text to avoid potential type misinterpretation
        ALTER TABLE public.settings ADD CONSTRAINT settings_id_check CHECK (id::text = 'global_settings');
    END IF;
END
$$;

-- Comments (safe to run multiple times, will just update)
COMMENT ON TABLE public.settings IS 'Stores global application settings, primarily for notifications. Expects only one row with id=''global_settings''.';
COMMENT ON COLUMN public.settings.id IS 'Primary key, fixed to ''global_settings''.';
COMMENT ON COLUMN public.settings.slack_webhook_url IS 'The Slack Incoming Webhook URL for sending alerts.';
COMMENT ON COLUMN public.settings.notification_emails IS 'An array of email addresses to receive alert notifications.';
COMMENT ON COLUMN public.settings.slack_notifications_enabled IS 'Flag to enable/disable Slack notifications globally.';
COMMENT ON COLUMN public.settings.email_notifications_enabled IS 'Flag to enable/disable email notifications globally.';
COMMENT ON COLUMN public.settings.created_at IS 'Timestamp when the settings row was first created.';
COMMENT ON COLUMN public.settings.updated_at IS 'Timestamp when the settings row was last updated.';

-- Trigger for updated_at (Create only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.settings'::regclass
        AND tgname = 'set_settings_timestamp'
    ) THEN
        CREATE TRIGGER set_settings_timestamp
        BEFORE UPDATE ON public.settings
        FOR EACH ROW
        EXECUTE FUNCTION public.trigger_set_timestamp();
    END IF;
END
$$; 