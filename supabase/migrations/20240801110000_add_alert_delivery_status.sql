-- Add delivery status tracking to alerts
BEGIN;

ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS delivery_status JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.alerts.delivery_status
IS 'Tracks the delivery status of notifications for this alert. Keys are channels (e.g., "email", "slack"), values are status strings (e.g., "delivered", "failed", "not_configured").';

COMMIT; 