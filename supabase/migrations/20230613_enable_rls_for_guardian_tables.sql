-- Enable RLS on core Guardian tables
ALTER TABLE payout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for payout_events
CREATE POLICY "Users can view their own payout events" ON payout_events
  FOR SELECT
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own payout events" ON payout_events
  FOR INSERT
  WITH CHECK (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Create policies for alerts
CREATE POLICY "Users can view their own alerts" ON alerts
  FOR SELECT
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own alerts" ON alerts
  FOR INSERT
  WITH CHECK (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own alerts" ON alerts
  FOR UPDATE
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Create policies for pending_notifications
CREATE POLICY "Users can view their own notifications" ON pending_notifications
  FOR SELECT
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own notifications" ON pending_notifications
  FOR INSERT
  WITH CHECK (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notifications" ON pending_notifications
  FOR UPDATE
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own notifications" ON pending_notifications
  FOR DELETE
  USING (
    stripe_account_id IN (
      SELECT stripe_account_id 
      FROM connected_accounts 
      WHERE user_id = auth.uid()
    )
  ); 