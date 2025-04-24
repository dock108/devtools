# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- Playwright smoke suite checks /, /stripe-guardian, /guardian-demo to prevent 404s in prod.
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

### Fixed

- Time-Warp cron now targets robust Node.js API routes with multi-stage fallback (npm script → direct ts-node execution), auto-installs missing dependencies, and ensures proper logging of all execution steps.
