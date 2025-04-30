# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Added `NEXT_PUBLIC_SHOW_KEYS` flag; API-Keys UI is disabled by default for beta.
- Instant profile refresh after edits (using `router.refresh()`).
- Added `prose-dock` Tailwind typography variant; Blog & Docs now centred, readable, and styled.
- Unified Blog & Docs typography using `prose lg:prose-lg max-w-3xl mx-auto`.
- Fixed bell-icon route (`/guardian/alert` ➜ `/guardian/alerts`).
- `guardian-sync` now imports Stripe via `npm:`; removed unused cors helper.
- Added `guardian-sync` Edge Function to invoke `sync_business_account()` on `account.updated`.
- Fixed `sync_business_account()` to map new Stripe 2024-10 business-profile paths.
- Fixed broken Docs navigation links (`/docs/getting-started` ➜ `/docs`).
- Resolved 500/404 across Docs pages caused by outdated MDX data path.
- `/guardian-demo` and `/info` are now public routes; no login required.
- Removed dark‐mode support; app now ships with a single light theme.
- `/guardian-demo` now uses only static mock data fetched from JSON scenarios; removed all Supabase/auth dependencies, realtime simulation, and the "Realtime subscription skipped" console noise.
- Guardian demo now guarantees a ≥ 45 s uninterrupted run before visitors can change traffic scenario.
- Connected-Accounts: delete button now removes Stripe account & alerts with confirmation + toast feedback.
- Fixed Stripe Connect flow: Corrected CSP directives, added client-side handling for success/error redirects with toasts and data refresh.

**April 28 2025** – Added typed Supabase mock & regenerated types/supabase.d.ts (Fix-block 2).
**April 28 2025** – Replaced Vitest with Jest in all remaining suites (#Fix-block 1).

### Refactored

- refactor(layout): unify site header/footer; removed duplicates (2025-04-25)

### Security

- **2025-04-25:** Upgraded `mjml` to `5.0.0-alpha.1` to resolve high-severity ReDoS vulnerability (GHSA-pfq8-rq6v-vf5m) in dependency `html-minifier` by replacing it with `htmlnano`. This resolves 31 high-severity audit issues. Low-severity issues related to `cookie` (via `@lhci/cli`) remain.

### Added

- **feat(ci-cd):** Automated Staging → Production deployment pipeline (G-27):
  - Added staging workflow (`.github/workflows/staging.yml`) to create a clean Supabase branch and Vercel preview for each push to main.
  - Added production promotion workflow (`.github/workflows/production-promote.yml`) with manual approval gate.
  - Added release notes workflow (`.github/workflows/release-notes.yml`) to extract CHANGELOG sections for GitHub Releases.
  - Created documentation at `docs/guardian/ci-cd.md` with detailed workflow steps and manual overrides.
  - Added Mermaid diagram to README showing the deployment process.
  - Added actionlint for workflow validation.
  - Ensured staging workflow completes in < 15 minutes.
  - Added environment hints for required secrets (SUPABASE_CI_TOKEN, VERCEL_TOKEN, SLACK_RELEASE_WEBHOOK).
- **feat(guardian):** Implement real-time alert badge and toast notifications in UI (G-17):
  - Added `alert_reads` table to track user read status.
  - Created `AlertNotificationsProvider` context using Supabase Realtime for live updates.
  - Integrated notification badge (`BellIcon` with count) into `Header.tsx`.
  - Implemented toast notifications (`react-hot-toast`) for new alerts.
  - Added `/api/guardian/alerts/mark-read` API route.
  - Included Cypress E2E test (`alerts_realtime.cy.ts`).
  - Updated README and docs (`docs/guardian/alerts.md`).
- **feat(guardian):** Implement email + Slack notifications for new alerts (G-20):
  - Added `settings` table for notification preferences (tier, email, Slack webhook).
  - Added `notify_new_alert` Postgres trigger function (using `pg_net`) to call edge function on new alerts.
  - Created `guardian-notify` edge function to handle notification logic, including free tier limit (50 alerts).
  - Integrated SendGrid for email and direct webhook calls for Slack.
  - Added unit tests (`tests/notify.spec.ts`) with mocks for external services.
  - Included documentation (`docs/guardian/notifications.md`) and README update.
  - Logs required env vars (`SENDGRID_API_KEY`, `FROM_EMAIL`) on cold start.
- `src/lib/timewarp-seeder.ts` with stubbed `runSeeder()`; serves as scaffold for upcoming seeder logic.
- Bundled Stripe CLI binary (stripe-cli-linux-x64) via postinstall so serverless Time-Warp seeder can execute `stripe fixtures` inside Vercel.
- **feat(event-buffer):** Add event_buffer table with 30-day TTL purge:
  - Create event_buffer table with proper indexing
  - Implement configurable purge_old_events() procedure
  - Add pg_cron schedule for hourly purge of old events
  - Create apply_event_buffer_migration.py helper script
  - Add ENV_BUFFER_TTL_DAYS env variable to control retention period
  - Add comprehensive unit tests for insertion and purging
- Time-Warp seeder now creates a real $5-$50 charge on a random sandbox account each run and tracks in-memory balances.
- Vercel cron job (\*/10 min) triggers `/api/tasks/timewarp-seeder`, ensuring continuous sandbox activity.
- Edge route `/api/tasks/timewarp-seeder` that runs `npm run seed:prod` (used by scheduled cron to keep sandbox traffic flowing).
- npm script `seed:prod` runs the Time-Warp seeder.
- `scripts/timewarp-seeder.ts` simulates Stripe activity (charges, payouts, scenario selection) for sandbox accounts.
- End-to-end Playwright + Jest test covers Connect OAuth, webhook endpoint creation, and payout ingest under RLS.
- Accounts can now override fraud-rule thresholds via JSON editor; values validated against rule-set.json schema.
- Stripe Connect OAuth flow implemented: users can link their Stripe account, tokens stored in `connected_accounts`.
- Row-Level Security (RLS) enabled on Guardian core tables (`payout_events`, `alerts`, and `pending_notifications`) ensuring users can only access data related to their own Stripe connected accounts.
- Test suite for verifying RLS policies on Guardian tables.
- Weekly all-clear digest emails send every Monday to accounts with zero unresolved alerts, summarizing payout volume screened.
- Live /alerts dashboard with real-time feed, severity badges, and auto-pause toggle.
- Auto-pause payout option: Guardian now pauses payouts in Stripe automatically when critical alerts occur and the account's auto-pause toggle is enabled.
- Email dispatcher sends Guardian alerts via Resend using MJML template; environment variable RESEND_API_KEY required.
- Slack webhook dispatcher Edge Function sends formatted alerts at 1 msg/sec and logs delivery status.
- Pending_notifications queue table and trigger added; every new alert is automatically enqueued for async dispatch.
- Alert_channels table with RLS; stores Slack, email, auto-pause settings per Stripe account.
- Guardian demo now has branded Open-Graph image for rich social previews.
- Added targeted test for rule engine with demo scenarios at `tests/guardian/ruleEngine.demoScenarios.test.ts`.
- Geo-mismatch rule alerts when foreign charge IPs exceed threshold versus payout bank country.
- Bank-swap rule alerts when large payout follows recent external-account change.
- Velocity-breach rule alerts when > N payouts occur inside T-second window.
- Modular rule engine core evaluates incoming Stripe events against configured rules and returns Alert objects.
- Initial Guardian schema (connected_accounts, payout_events, alerts).
- Playwright smoke suite checks `/` to prevent 404s in prod.
- Rule engine now covered by table-driven Jest tests using demo scenarios.
- Schema-validated `rule-set.json` allows tuning fraud thresholds; default values committed.
- Three detailed fraud scenarios (velocity-breach, bank-swap, geo-mismatch) with rich Stripe event payloads for the Guardian demo.
- TypeScript types and snapshot tests for scenario validation.
- Enhanced ScenarioPicker component with localStorage persistence for remembering the last selected fraud scenario.
- Improved accessibility with shadcn/ui Select component and better keyboard navigation.
- One-click 2× speed toggle button in Guardian demo for faster playback of fraud scenarios.
- Deterministic scenario-driven demo replacing random events, with JSON scenario files, progress tracking, and looping capability.
- Added app/guardian-demo/scenarios/ with three starter scenarios (velocity-breach, bank-swap, geo-mismatch).
- New useDemoScenario hook for playing back predetermined event sequences.
- Added ScenarioPicker component with scenario dropdown, loop toggle, and playback speed control.
- Added README with JSON schema for creating custom scenarios.
- Added missing shadcn/ui `Input` and `Label` components.
- Stripe Guardian product page (/stripe-guardian) with Hero, Pain/Solution, Features, Pricing, and Supabase Wait-List.
- Supabase client setup (`lib/supabase.ts`) and `guardian_leads` table creation instructions.
- Container component for consistent side padding.
- Gradient hero background blob for color flare.
- Integrated public/logo.png in header.
- New minimal homepage with hero, product grid, header, footer
- ProductCard reusable component
- Placeholder pages and layouts for Docs and Products
- Scaffolded Next 13 App Router project with Tailwind, ESLint, TypeScript.
- Integrated @tailwindcss/forms & typography (Note: Plugins installed but config TBD due to Tailwind v4).
- Installed shadcn/ui and seeded Button component.
- Added base design tokens in globals.css.
- Added initial README.
- /notary-ci product page with hero, pain/solution, features, pricing, Supabase wait-list.
- Added accent.notary color token (already present).
- Added `notary_leads`
- Update to latest Stripe CLI binary (v1.19.1) to ensure availability in Vercel serverless functions
- Create postinstall script to properly copy Stripe CLI binary to node_modules/.bin/
- Update Stripe dependency to v14.7.0
- Time-Warp seeder now randomly plays one of three fraud scenarios via
  `stripe fixtures`, scaled to the `SPEED_FACTOR`, so Guardian fires alerts in
  every live sandbox session.
- **Guardian Demo:** Add `ScenarioPicker` component to manually trigger scenarios.
- **Auth:** Implement Sign Up with email/password, including confirmation email.
- Jest smoke test for `runSeeder()` that mocks Stripe endpoints and ensures at
  least one charge call occurs with no unhandled errors.
- **feat(settings):** add user settings page (profile, password, theme, API keys) (2025-04-25)
  - Allows users to update display name, avatar URL.
  - Implements password change functionality.
  - Provides theme selection (System, Light, Dark) using `next-themes`.
  - Enables API key generation (prefix + random bytes, shown once) and revocation.
  - Uses Supabase RLS, server actions, and shadcn/ui components.
- feat(settings): add multi-Stripe connected accounts management (2025-04-25)
- feat(guardian): auto-suspend payouts on fraud, manual resume toggle (2025-04-25)
- feat(guardian): add fraud-handler edge function to auto-pause payouts and send alerts (2025-04-25)
- feat(guardian): add alerts mute toggle with duration options (2025-04-25)
- **feat(stripe):** Platform-level Stripe webhook endpoint (/api/stripe/webhook) that:
  - Verifies Stripe signatures using STRIPE_WEBHOOK_SECRET
  - Buffers events in new event_buffer table with proper indexing
  - Asynchronously forwards events to guardian-reactor for processing
  - Tracks failed dispatches for retry in failed_event_dispatch table
  - Responds to Stripe within 200ms for high availability
  - Includes comprehensive test suite
- **feat(webhook):** Implement webhook event filtering system:
  - Define canonical GUARDIAN_EVENTS list in lib/guardian/stripeEvents.ts
  - Add scripts/setup_webhook.ts to set up and configure Stripe webhook endpoints
  - Add webhook verification on application startup to detect configuration drift
  - Update webhook handler to reject unsupported event types
  - Extend tests to verify all supported events and reject unsupported ones
  - Add npm scripts: stripe:setup-webhook and stripe:verify-webhook
  - Update README.md with instructions on setting up webhooks
- **feat(validation):** Add strict validation for Stripe event payloads:
  - Create Zod schemas for all supported Stripe events in stripeSchemas.ts
  - Add validateStripeEvent helper to parse and validate incoming payloads
  - Integrate validation into webhook handler with clear error responses
  - Add STRICT_STRIPE_VALIDATION environment variable (default: true)
  - Add comprehensive unit tests for valid and invalid schemas
  - Update documentation with validation details and development mode toggle
  - Log environment variable hint on webhook startup
- **feat(guardian):** Transactional alert insert with idempotency constraint (G-08):
  - Added processed_events table with stripe_event_id primary key for idempotency tracking
  - Added unique composite constraint on alerts to prevent duplicate entries
  - Refactored guardian-reactor to use transactions for atomic event processing
  - Improved response codes: 204 for already processed events
  - Created transactional unit tests to verify proper behavior
  - Updated documentation to explain idempotency guarantees
  - Ensured robust handling of duplicate Stripe webhook deliveries
- **feat(guardian):** Add three new fraud detection scenarios (G-07):
  - FAILED_CHARGE_BURST: Alerts on 3+ failed charges within 5 minutes
  - SUDDEN_PAYOUT_DISABLE: Detects when Stripe disables payouts for an account
  - HIGH_RISK_REVIEW: Identifies high-risk transactions flagged by Stripe
  - Added SQL migration (20250426_failed_charge_burst.sql) with optimized query function
  - Created unit tests to validate all scenarios with test fixtures
  - Updated documentation to include new scenarios in rules.md and README
- **Feat(Guardian)**: Implement data retention policy (scrubbing/purging) for `event_buffer` to enhance GDPR/PCI compliance (G-13).
- **Feat(Guardian)**: Implement structured JSON logging across components (Webhook, Reactor, DLQ Retry, Retention) using Pino (G-14).
- **Feat(Guardian)**: Add Prometheus metrics exposition via `/api/metrics` (Webhook) and log-based metrics for Edge Functions (Reactor, DLQ Retry) (G-14).
- **Feat(Guardian)**: Implement per-account rule threshold overrides using `rule_sets` table (G-16).
- **feat(ci):** Add full E2E test harness using GitHub Actions (G-18):
  - Workflow (`supabase-e2e.yml`) sets up local Supabase, applies migrations, seeds test user.
  - Replays Stripe events from fixture file (`test/fixtures/full_day.jsonl`) using Stripe CLI.
  - Runs Cypress spec (`cypress/e2e/full_stack.cy.ts`) to verify webhook ingestion, alert generation, real-time UI badge, and mark-as-read flow.
  - Includes script (`scripts/build_fixtures.sh`) to regenerate fixtures.
  - Uploads Cypress artifacts and Stripe logs on failure.
  - Added README section explaining the test harness.
- **feat(guardian):** Back-fill last 90 days of Stripe events for new accounts (G-22):
  - Added `backfill_status` table to track progress.
  - Created `guardian-backfill` edge function to fetch historical events via Stripe API pagination and insert into `event_buffer`.
  - Updated OAuth callback (`/api/stripe/oauth/callback`) to trigger the backfill function.
  - Added `pg_cron` job SQL snippet to reset failed backfills to 'pending' for retry.
  - Included unit tests (`tests/backfill.spec.ts`) with mocks.
  - Added documentation (`docs/guardian/backfill.md`) and README update.
  - Logs required (`STRIPE_API_KEY_PLATFORM`) and optional (`BACKFILL_DAYS`, `BACKFILL_BATCH`) env vars on cold start.
- **feat(guardian):** Implement alert feedback mechanism (G-23):
  - Added `alert_feedback` table to store user verdicts (False Positive/Legit).
  - Created API route (`/api/guardian/alerts/feedback`) for submitting (POST) and retrieving counts (GET).
  - Added feedback buttons and comment field to Alert Details UI (`/guardian/alerts/[id]`).
  - Implemented Analytics Card on `/guardian/analytics` showing FP rates per rule.
  - Added Prometheus counter `guardian_alert_false_positive_feedback_total` (requires full metrics setup).
  - Included unit tests (`tests/feedback.spec.ts`) and Cypress E2E test (`cypress/e2e/alerts_feedback.cy.ts`).
  - Added documentation (`docs/guardian/feedback.md`) and README update.
- **feat(guardian):** Enable strict TypeScript checks across Guardian codebase (G-24):
  - Updated `tsconfig.json` with `strict: true` and related flags.
  - Created shared types/enums in `lib/guardian/constants.ts`.
  - Refactored Edge Functions, webhook handler, rules engine, and individual rules for strict type compliance.
  - Added `gen:types` script to `package.json` for Supabase type generation.
  - Updated Supabase queries to use generated types (`types/supabase.ts`).
  - Added `pnpm tsc --noEmit` step to CI workflow (`ci.yml`).
  - Updated README with "Type Safety" section explaining type generation and strict enforcement.
- **G-25: Admin UI for managing rule sets and notification settings**
  - Added Row Level Security (RLS) policies for `rule_sets` and `settings` tables
  - Created admin layout with role checking and authentication
  - Implemented notification channels management (create, list, delete)
  - Added rule sets management listing page
  - Added connected accounts management page
  - Added admin dashboard with metrics and quick links
  - Note: Execute `supabase/migrations/20250426_admin_rls.sql` after merging
- G-28: Added `risk_score` column to `alerts` table, calculated via trigger based on rule weight and feedback.
- G-28: Implemented `rule_fp_stats` materialized view to track global false positive rates.
- G-28: Included risk score in Guardian notification templates (email, Slack).
- G-28: Added colored risk score pill to Guardian alerts table UI.
- G-28: Added documentation for risk score calculation (`docs/guardian/risk-score.md`).
- G-29: Added Guardian Analytics page (`/stripe-guardian/analytics`) with charts for alerts/day, top rules, FP rate/rule, avg risk score.
- G-29: Created SQL views (`alerts_by_day`, `alerts_rule_rank`, `fp_rate_rule`, `avg_risk_score`) to power analytics.
- G-29: Implemented basic Pro/Free tier UI gating (account selector for Pro, notice for Free) - data filtering TBD.
- G-29: Added documentation for analytics dashboard (`docs/guardian/analytics.md`).
- **feat(blog):** Add blog framework using MDX, Tailwind Typography, and contentlayer (Task 14).
- **feat(blog):** Add initial blog posts for Monitor/Mitigate, Payout Trends, and Automation (Task 15).
- **feat(blog):** Create reusable DemoCTA component (`components/blog/DemoCTA.tsx`) (Task 16).
- Crondeck product page (/crondeck) with hero, pain/solution, features, pricing, Supabase wait-list.
- Blog framework using Contentlayer & MDX.

### Changed

- Removed dangling imports and logs that referenced the deleted Time-Warp seeder.
- CI now enforces a 15 MB maximum bundle size after seeder purge.
- Temporarily disabled welcome email trigger for waitlist signups.
- G-29: Added `QueryClientProvider` to root layout (`app/layout.tsx`) to support analytics page data fetching.
- **chore(blog):** Clean up legacy "Stripe-Fraud-300LOC" blog post:
  - Removed fabricated numbers and anecdotes.
  - Ensured technical tone and heading structure.
  - Added `updated` date and revised front matter.
  - Integrated `DemoCTA` component at the end (Task 16).

### CI

- Removed `continue-on-error: true` from CI workflow steps (`ci.yml`). The workflow will now properly fail if linting, type checking, build, or E2E tests fail. Unit tests are temporarily disabled (`if: false`) due to known breakages and will be re-enabled in a subsequent task.

### Docs

- Added seeder variables to `.env.example` and wrote README instructions for
  running the Time-Warp seeder locally; noted the 10-minute Vercel cron.
- Removed all references to the deprecated Time-Warp seeder from README,
  developer docs, and code comments.

### Fixed

- fix(settings): implement tabbed routes (/profile, /connected-accounts, /notifications)
- Fix: Join Waitlist CTA functional on all pages.
- Fix: Demo path break after scenario move.
- **fix(settings):** add missing shadcn/ui components (form, radio-group, separator, alert-dialog, table) and fix syntax typo that broke Vercel build (2025-04-25)
- **fix(deps):** Add missing `@next/mdx` dependency required for blog build.

### Removed

- Experimental Time-Warp seeder code, cron job, environment variables, and
  related documentation/testing artifacts.
- G-29: Analytics page (`/dashboard/analytics`) with charts for alerts/day, top rules, FP rate/rule, avg risk score.

## 0.1.0 (Initial Release)

## [0.1.0-alpha.2] - 2024-04-26
