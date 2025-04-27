-- Atomic insert of alert + enqueue of notifications
create or replace function insert_alert_and_enqueue(
  p_event_id       uuid,
  p_rule_id        text,
  p_user_id        uuid,
  p_channels       text[] default '{email,slack}'::text[]
) returns uuid
language plpgsql security definer
as $$
declare
  v_alert_id uuid;
  v_chan text;
begin
  -- 1. Insert alert
  insert into alerts(event_id, rule_id, user_id)
       values (p_event_id, p_rule_id, p_user_id)
    returning id into v_alert_id;

  -- 2. Enqueue a job per channel
  -- Ensure enqueue_notification exists from previous migration 20250501_notifier_queue.sql
  -- It takes (p_alert_id uuid, p_channel text)
  foreach v_chan in array p_channels loop
    perform public.enqueue_notification(v_alert_id, v_chan);
  end loop;

  return v_alert_id;
end;
$$; 