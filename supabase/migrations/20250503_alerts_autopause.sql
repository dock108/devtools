-- Add auto_pause column to alerts table
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS auto_pause boolean DEFAULT false; 