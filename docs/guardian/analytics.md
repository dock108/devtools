# Guardian Analytics Dashboard

The Guardian Analytics dashboard, available at `/stripe-guardian/analytics`, provides key performance indicators (KPIs) and trends related to alert activity and rule performance.

## Access Tiers

- **Free Tier Users:** See aggregated global metrics across all accounts.
- **Pro Tier Users:** See metrics specific to their selected Stripe connected account (using the account dropdown selector).

_(Note: Account-specific data filtering is planned for a future iteration. Currently, all users see global data, but the account selector is present for Pro users)._

## Metrics & Charts

The dashboard displays the following metrics in cards, each with a corresponding chart:

**(Screenshot Placeholder: Full Analytics Dashboard)**
`![Analytics Dashboard Screenshot](placeholder_analytics_dashboard.png)`

1.  **Alerts / Day (Last 30 Days)**

    - **Description:** Shows the daily volume of alerts triggered over the past 30 days.
    - **Chart Type:** Line Chart
    - **Use Case:** Identify spikes or trends in overall alert activity.
    - **Data Source:** `public.alerts_by_day` view.
      **(Screenshot Placeholder: Alerts / Day Chart)**
      `![Alerts Per Day Chart](placeholder_alerts_day.png)`

2.  **Top Rules by Count (Last 30 Days)**

    - **Description:** Ranks alert types by the total number of times they were triggered in the past 30 days.
    - **Chart Type:** Horizontal Bar Chart
    - **Use Case:** Identify the noisiest or most active rules.
    - **Data Source:** `public.alerts_rule_rank` view.
      **(Screenshot Placeholder: Top Rules Chart)**
      `![Top Rules Chart](placeholder_top_rules.png)`

3.  **False Positive Rate by Rule (Last 30 Days)**

    - **Description:** Shows the percentage of alerts marked as "False Positive" via user feedback for each rule type over the past 30 days.
    - **Chart Type:** Horizontal Bar Chart
    - **Use Case:** Identify rules that frequently generate false positives, potentially indicating a need for tuning thresholds or improving rule logic.
    - **Data Source:** `public.fp_rate_rule` view.
      **(Screenshot Placeholder: FP Rate Chart)**
      `![FP Rate Chart](placeholder_fp_rate.png)`

4.  **Average Risk Score (Last 7 Days)**
    - **Description:** Shows the daily average `risk_score` for alerts triggered over the past 7 days.
    - **Chart Type:** Area Chart
    - **Use Case:** Monitor the overall risk trend of triggered alerts. Changes might correlate with shifts in fraud patterns or the effectiveness of feedback loops.
    - **Data Source:** `public.avg_risk_score` view.
      **(Screenshot Placeholder: Avg Risk Score Chart)**
      `![Avg Risk Score Chart](placeholder_avg_risk.png)`

## Data Sources

Data is primarily sourced from SQL views defined in the `supabase/migrations/20250426_analytics_views.sql` migration file. These views query the `public.alerts` and `public.alert_feedback` tables.

## Future Enhancements

- Implement account-specific data filtering for Pro users.
- Add date range selection.
- Include more detailed metrics (e.g., alert resolution times, trends in specific rule parameters).
- Add export functionality.
