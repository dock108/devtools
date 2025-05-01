-- Fix RLS policy to correctly check auth_uid
DROP POLICY IF EXISTS "Users can manage their own jobs" ON public.jobs;

CREATE POLICY "Users can manage their own jobs"
  ON public.jobs
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM public.users
      WHERE auth_uid = auth.uid()
    )
  ); 