-- Create processed_events table for idempotency tracking
CREATE TABLE IF NOT EXISTS public.processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  process_duration_ms INTEGER,
  alerts_created INTEGER DEFAULT 0
);

-- Create index for efficient querying by account_id and time
CREATE INDEX IF NOT EXISTS processed_events_account_time_idx ON public.processed_events (stripe_account_id, processed_at DESC);

-- Enable RLS (default deny)
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for platform service
CREATE POLICY "Only platform can access processed_events"
  ON public.processed_events
  USING (auth.jwt() ->> 'role' = 'platform_service');

-- Add TTL purge function
CREATE OR REPLACE PROCEDURE purge_old_processed_events()
LANGUAGE plpgsql
AS $$
DECLARE
  ttl_days INT;
  purged_count INT;
BEGIN
  -- Get TTL days from settings or use default (30)
  SELECT coalesce(current_setting('app.processed_events_ttl_days', true)::INT, 30) INTO ttl_days;
  
  -- Delete events older than TTL
  DELETE FROM public.processed_events
  WHERE processed_at < current_timestamp - (ttl_days || ' days')::INTERVAL
  RETURNING count(*) INTO purged_count;
  
  RAISE NOTICE 'Purged % processed events older than % days', purged_count, ttl_days;
END;
$$;

-- Schedule hourly purge via pg_cron
SELECT cron.schedule(
  'processed_events_ttl',
  '0 * * * *',
  $$ CALL purge_old_processed_events(); $$
); 