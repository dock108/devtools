# Stripe Guardian Documentation Public/Private Map

This file classifies all documentation files in the `docs/guardian` directory as:

- **Public**: Can be published as-is to external documentation
- **Internal**: Contains sensitive information and should not be published
- **Mixed**: Contains both public and sensitive sections that need redaction

## Files Classification

| File | Status | Action |
|------|--------|--------|
| admin-ui.md | Mixed | Redact sensitive sections (schemai) |
| alerts.md | Mixed | Redact sensitive sections (schemai) |
| analytics.md | Mixed | Redact sensitive sections (migrations\\d+i) |
| backfill.md | Mixed | Redact sensitive sections (sql i) |
| ci-cd.md | Mixed | Redact sensitive sections (supabasei) |
| content-guidelines.md | Public | Keep entire file |
| feedback.md | Public | Keep entire file |
| grafana.json | Internal | Do not publish |
| guardian-schema.md | Mixed | Redact sensitive sections (schemai) |
| local-dev.md | Mixed | Redact sensitive sections (supabasei) |
| logging.md | Mixed | Redact sensitive sections (environment variablei) |
| metrics.md | Mixed | Redact sensitive sections (supabasei) |
| notifications.md | Mixed | Redact sensitive sections (supabasei) |
| onboarding.md | Mixed | Redact sensitive sections (Contains schema information, but public user flow info) |
| perf.md | Mixed | Redact sensitive sections (sql i) |
| retention.md | Mixed | Redact sensitive sections (sql i) |
| risk-score.md | Mixed | Redact sensitive sections (sql i) |
| rules.md | Mixed | Redact sensitive sections (schemai) |
| security.md | Internal | Do not publish |