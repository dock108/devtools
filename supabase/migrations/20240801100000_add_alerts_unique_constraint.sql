-- Add unique constraint to prevent duplicate alerts for the same event and rule type
BEGIN;

-- Add the constraint
ALTER TABLE public.alerts
ADD CONSTRAINT alerts_event_id_alert_type_key UNIQUE (event_id, alert_type);

-- Optional: Consider adding an index on (event_id, alert_type) if not already covered
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_event_id_alert_type ON public.alerts (event_id, alert_type);

COMMIT; 