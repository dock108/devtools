-- Add new alert types to system if enum is used
-- If using text field, no schema change needed - just documentation

-- Add comment documenting the alert types
COMMENT ON COLUMN public.alerts.alert_type IS 'Alert types: VELOCITY, BANK_SWAP, GEO_MISMATCH, FAILED_CHARGE_BURST, SUDDEN_PAYOUT_DISABLE, HIGH_RISK_REVIEW';

-- Create view for querying failed charges (for performance)
CREATE OR REPLACE VIEW public.failed_charges_view AS
SELECT *
FROM public.event_buffer
WHERE type IN ('charge.failed', 'payment_intent.payment_failed');

-- Add index to improve performance of the failed charges query
CREATE INDEX IF NOT EXISTS idx_event_buffer_failed_charges
ON public.event_buffer (stripe_account_id, received_at)
WHERE type IN ('charge.failed', 'payment_intent.payment_failed');

-- Function to count recent failed charges for an account
CREATE OR REPLACE FUNCTION count_recent_failed_charges(
  p_account_id TEXT,
  p_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO failed_count
  FROM public.event_buffer
  WHERE stripe_account_id = p_account_id
    AND type IN ('charge.failed', 'payment_intent.payment_failed')
    AND received_at > (now() - (p_minutes || ' minutes')::interval);
  
  RETURN failed_count;
END;
$$ LANGUAGE plpgsql; 