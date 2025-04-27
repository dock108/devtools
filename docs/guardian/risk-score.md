# Guardian Risk Score

Guardian assigns a numerical Risk Score (0-100) to each alert to provide a more nuanced assessment than severity alone. This score helps prioritize alerts and understand the confidence in a particular alert being a true positive.

## Calculation Formula

The risk score is calculated _before_ an alert is inserted into the database using a `BEFORE INSERT` trigger (`trg_set_risk_score_before`) that calls the `public.compute_risk_score_before()` PostgreSQL function.

The formula aims to blend a baseline rule weight with factors learned from user feedback:

\[
\text{Risk Score} = \text{Clamp}\_{0}^{100} \left( \text{Rule Weight} \times (1 - \text{Account FP Rate}) \times (1 - \text{Global FP Rate}) \times 2 \right)
\]

Where:

- **Rule Weight:** A predefined baseline score for each `alert_type` (e.g., `velocity` = 30, `bank_swap` = 40). These weights are defined within the `compute_risk_score_before` function.
- **Account FP Rate:** The historical false positive rate for _this specific rule type_ on _this specific Stripe account_. Calculated as:
  \[
  \frac{\text{Total FPs for Rule on Account}}{\text{Total Alerts for Rule on Account}}
  \]
  This is computed dynamically within the trigger function by querying the `alerts` and `alert_feedback` tables.
- **Global FP Rate:** The historical false positive rate for _this specific rule type_ across _all_ accounts. This value is sourced from the `public.rule_fp_stats` materialized view.
  \[
  \frac{\text{Total FPs for Rule Globally}}{\text{Total Alerts for Rule Globally}}
  \]
- **Scaling Factor (2):** An arbitrary factor to scale the resulting score towards the 0-100 range.
- **Clamp (0-100):** Ensures the final score stays within the bounds of 0 and 100.

## Materialized View (`rule_fp_stats`)

To efficiently calculate the Global FP Rate, a materialized view `public.rule_fp_stats` is used. This view pre-calculates the total alerts and false positive counts for each `alert_type`.

**Important:** This materialized view must be refreshed periodically to incorporate new feedback data. It is recommended to schedule a nightly job to run:

```sql
REFRESH MATERIALIZED VIEW public.rule_fp_stats;
```

(Consult Supabase documentation for scheduling options, e.g., using `pg_cron` or external schedulers).

## UI Thresholds

The UI uses the following color-coded thresholds for the Risk Score pill:

- **Green (Low Risk):** Score < 30
- **Yellow (Medium Risk):** Score 30 - 60
- **Red (High Risk):** Score > 60
- **Gray (N/A):** Score is null (should generally not happen for new alerts due to the trigger).

## Future ML Direction

This initial implementation uses a simple weighted formula. Future iterations could involve:

- Training a more sophisticated ML model (e.g., Logistic Regression, Gradient Boosting) using features like account tenure, transaction volume, historical alert patterns, etc.
- Deploying the model potentially outside the database (e.g., as a separate microservice or edge function) for more complex feature engineering and processing.
- Implementing online learning or more frequent model updates based on feedback.
- Adding more factors to the calculation (e.g., time decay for feedback relevance).
