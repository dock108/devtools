# Guardian Alert Feedback

Stripe Guardian allows users to provide feedback on the accuracy of generated alerts. This helps improve the system over time and provides valuable insights into rule performance.

## How it Works

1.  **UI**: On the details page for a specific alert (`/guardian/alerts/[id]`), authenticated users are presented with buttons to classify the alert as either "🚫 False Positive" or "✅ Legit".
2.  **API**: Clicking a button sends a `POST` request to `/api/guardian/alerts/feedback` with the `alertId` and the chosen `verdict` (`false_positive` or `legit`).
    - If the user selects "False Positive", they are given the option to add a text comment explaining why.
    - The API uses the user's session to identify them.
3.  **Database**: The feedback is stored in the `public.alert_feedback` table.
    - Each row links an `alert_id` to a `user_id` and stores their `verdict` and optional `comment`.
    - A unique constraint (`alert_id`, `user_id`) ensures each user can only provide one feedback entry per alert. Submitting a new verdict updates the existing entry.
4.  **Analytics**: Aggregated feedback data is displayed on the Guardian Analytics page (`/guardian/analytics`).
    - A summary card shows the total number of alerts, the number marked as false positives, and the false-positive rate (%) for each rule type.
5.  **Metrics**: A Prometheus counter (`guardian_alert_false_positive_feedback_total`) is incremented each time an alert is marked as a false positive. This counter includes a `rule` label corresponding to the `alert_type`.

## Data Storage & Privacy

- Feedback is linked to the specific user (`user_id`) who provided it.
- If a user account is deleted from `auth.users`, their corresponding `user_id` in `alert_feedback` is set to `NULL` (due to `on delete set null`), but the feedback itself is retained anonymously to preserve historical accuracy of the counts.
- Comments associated with false positives are stored as plain text.

## Future Enhancements

- Use feedback data to automatically tune rule thresholds.
- Incorporate feedback into a machine learning model to score alert risk more accurately.
- Allow admins to review feedback comments easily.
- Provide a mechanism to fully delete feedback (requires API changes).
