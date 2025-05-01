-- Create crondeck_leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.crondeck_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT current_timestamp
); 