-- Migration for Guardian Analytics Views

-- Alerts per day (last 30 days)
create or replace view public.alerts_by_day as
select date_trunc('day', created_at at time zone 'utc') as day, -- Use created_at
       count(*)                         as alerts
from public.alerts
where created_at >= (current_date - interval '30 days') at time zone 'utc' -- Use created_at
group by day
order by day;

-- Top rules by count (last 30 days)
create or replace view public.alerts_rule_rank as
select alert_type,
       count(*) as alerts
from public.alerts
where created_at >= (current_date - interval '30 days') at time zone 'utc' -- Use created_at
group by alert_type
order by alerts desc;

-- False-positive rate per rule (last 30 days)
create or replace view public.fp_rate_rule as
select al.alert_type, -- Use alias
       count(distinct al.id)                                  as total_alerts, -- Count distinct alerts
       coalesce(sum(case when af.verdict='false_positive' then 1 else 0 end),0) as fp_count, -- Alias and use af alias
       (coalesce(sum(case when af.verdict='false_positive' then 1 else 0 end),0)::numeric
        / greatest(count(distinct al.id),1))                  as fp_rate -- Count distinct alerts and use af alias
from public.alerts al -- Alias left table
left join public.alert_feedback af on al.id = af.alert_id -- Explicit ON clause with aliases
where al.created_at >= (current_date - interval '30 days') at time zone 'utc' -- Use created_at
group by al.alert_type
order by fp_rate desc;

-- Average risk score per day (last 7 days)
create or replace view public.avg_risk_score as
select date_trunc('day', created_at at time zone 'utc') as day, -- Use created_at
       avg(risk_score)                 as avg_risk
from public.alerts
where created_at >= (current_date - interval '7 days') at time zone 'utc' -- Use created_at
  and risk_score is not null -- Only average non-null scores
group by day
order by day;

-- Note: Consider adding RLS policies to these views if needed,
-- especially if Pro tier requires account-specific filtering later.
-- Example (Allow authenticated users to read):
-- alter view public.alerts_by_day owner to postgres;
-- grant select on public.alerts_by_day to authenticated; 