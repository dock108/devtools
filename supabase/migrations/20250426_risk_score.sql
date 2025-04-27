-- Add risk_score column to alerts table
alter table public.alerts
  add column if not exists risk_score numeric;  -- 0-100

-- Create helper materialized view for per-rule false-positive rates
create materialized view if not exists public.rule_fp_stats as
select al.alert_type, -- Use alias
       count(distinct al.id)                    as total_alerts, -- Count distinct alerts
       coalesce(sum(case when af.verdict='false_positive' then 1 else 0 end),0) as fp_count, -- Alias and use af alias
       (coalesce(sum(case when af.verdict='false_positive' then 1 else 0 end),0)::numeric
        / greatest(count(distinct al.id),1))    as fp_rate -- Count distinct alerts and use af alias
from public.alerts al -- Alias left table
left join public.alert_feedback af on al.id = af.alert_id -- Explicit ON clause with aliases
group by al.alert_type; -- Group by alias.column

-- Create function to compute risk score
create or replace function public.compute_risk_score_before() -- Renamed for clarity
returns trigger language plpgsql as $$ -- Return type is TRIGGER
declare
  rule_weight int;
  acct_rule_fp numeric;
  global_fp numeric;
  -- No need for 'a record' or '_alert_id', use NEW directly
begin
  -- baseline weights (Adjust these as needed)
  rule_weight := case NEW.alert_type -- Use NEW.alert_type
                   when 'velocity'             then 30
                   when 'bank_swap'            then 40
                   when 'geo_mismatch'         then 25
                   when 'failed_charge_burst'  then 35
                   when 'sudden_payout_disable'then 20
                   when 'high_risk_review'     then 50
                   else 10 -- Default weight for unknown types
                 end;

  -- per-account FP rate for the specific rule type
  select coalesce(sum(case when f.verdict='false_positive' then 1 else 0 end)::numeric
                  / greatest(count(al.id),1), 0)
  into acct_rule_fp
  from public.alerts al
  left join public.alert_feedback f on al.id = f.alert_id
  where al.stripe_account_id = NEW.stripe_account_id -- Use NEW.stripe_account_id
    and al.alert_type = NEW.alert_type; -- Use NEW.alert_type

  -- global FP rate from materialized view
  select coalesce(fp_rate, 0) into global_fp
  from public.rule_fp_stats
  where alert_type = NEW.alert_type; -- Use NEW.alert_type

  -- Assign the calculated score directly to the NEW record's column
  NEW.risk_score := least(100, greatest(0,
                   rule_weight * (1 - acct_rule_fp) * (1 - global_fp) * 2)); -- Scaling factor of 2

  -- Return the (modified) NEW record to be inserted
  RETURN NEW;
end; $$;

-- Drop the old AFTER trigger if it exists
drop trigger if exists trg_set_risk_score on public.alerts;

-- Create the new BEFORE trigger
create trigger trg_set_risk_score_before -- Renamed for clarity
before insert on public.alerts -- Use BEFORE INSERT
for each row execute function public.compute_risk_score_before(); -- No arguments

-- Initial population for existing alerts (optional, run manually if needed)
-- This might take time on large tables. Consider doing it in batches.
-- DO $$
-- DECLARE
--     alert_rec record;
-- BEGIN
--     FOR alert_rec IN SELECT id FROM public.alerts WHERE risk_score IS NULL LOOP
--         PERFORM public.compute_risk_score(alert_rec.id);
--     END LOOP;
-- END $$;

-- Remember to schedule 'REFRESH MATERIALIZED VIEW public.rule_fp_stats;' nightly. 