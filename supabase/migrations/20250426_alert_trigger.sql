-- Migration: Create trigger function and trigger for alert notifications
-- G-20: Email + Slack Notifications on New Alerts

-- Ensure pg_net extension is available
create extension if not exists pg_net with schema extensions; -- Use the dedicated extensions schema

-- Function to call the notification edge function
create or replace function public.notify_new_alert()
returns trigger as $$
declare
  guardian_notify_url text := 'https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/guardian-notify'; -- Replace <YOUR_SUPABASE_PROJECT_REF> with your actual project reference
  service_role_key text := ''; -- Service role key should be securely stored, not hardcoded. Fetch from vault/secrets if possible.
begin
  -- IMPORTANT: Storing secrets directly in SQL is insecure.
  -- Consider using Supabase Vault or another secrets manager.
  -- This example uses a placeholder and assumes the key is accessible somehow.
  -- You might need to adjust how the key is retrieved based on your setup.
  -- Example placeholder - DO NOT USE IN PRODUCTION:
  -- select decrypted_secret into service_role_key from supabase_vault.secrets where name = 'supabase_service_role';

  -- Check if SUPABASE_SERVICE_ROLE_KEY is set in environment for edge functions
  -- If running locally, you might need to load it differently.
  -- The edge function itself will use the env var provided by Supabase hosting.

  -- Perform the HTTP POST request to the edge function
  -- Note: The service_role_key is passed implicitly when called from Supabase trigger usually,
  -- but pg_net might require explicit headers depending on setup.
  -- Let's assume the edge function will handle auth via its environment.
  perform
    net.http_post(
      url := guardian_notify_url,
      body := jsonb_build_object('alert_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
        -- Optionally pass Authorization header if edge function requires it and cannot get it from context
        -- 'Authorization', 'Bearer ' || service_role_key
      ),
      timeout_milliseconds := 2000 -- 2 second timeout
    );

  return new;

exception
  when others then
    -- Log the error instead of failing the transaction
    raise warning 'Failed to trigger guardian-notify for alert_id %: %', new.id, sqlerrm;
    return new; -- Allow the original insert to succeed
end;
$$ language plpgsql volatile security definer;
-- SECURITY DEFINER allows the function to run with the permissions of the user who defined it (typically postgres role)
-- VOLATILE because it performs side effects (HTTP request)

comment on function public.notify_new_alert is 'Trigger function to call the guardian-notify edge function when a new alert is inserted.';

-- Trigger that fires after each row insert on the alerts table
create trigger alerts_notify_tg
after insert on public.alerts
for each row execute procedure public.notify_new_alert();

comment on trigger alerts_notify_tg on public.alerts is 'Fires after an alert is inserted to trigger the notification process.'; 