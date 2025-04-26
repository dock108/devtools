-- Create processed_events table to track event processing status
CREATE TABLE IF NOT EXISTS public.processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  process_duration_ms INTEGER,
  alerts_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

-- Only allow platform users to read
CREATE POLICY "Platform users can read processed_events" 
  ON public.processed_events 
  FOR SELECT 
  TO authenticated 
  USING (auth.jwt() ->> 'app_role' = 'platform_user');

-- Allow the service role to insert/update
CREATE POLICY "Service role can insert processed_events" 
  ON public.processed_events 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

-- Add indexes
CREATE INDEX idx_processed_events_stripe_event_id ON public.processed_events(stripe_event_id);
CREATE INDEX idx_processed_events_stripe_account_id ON public.processed_events(stripe_account_id);
CREATE INDEX idx_processed_events_processed_at ON public.processed_events(processed_at);

-- Add comments
COMMENT ON TABLE public.processed_events IS 'Tracks events that have been processed by guardian-reactor';
COMMENT ON COLUMN public.processed_events.stripe_event_id IS 'The Stripe event ID that was processed';
COMMENT ON COLUMN public.processed_events.stripe_account_id IS 'The Stripe account ID associated with the event';
COMMENT ON COLUMN public.processed_events.processed_at IS 'When the event was processed';
COMMENT ON COLUMN public.processed_events.process_duration_ms IS 'How long processing took in milliseconds';
COMMENT ON COLUMN public.processed_events.alerts_created IS 'Number of alerts created during processing'; 