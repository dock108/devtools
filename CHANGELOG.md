# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Guardian schema (connected_accounts, payout_events, alerts).
- Playwright smoke suite checks /, /stripe-guardian, /guardian-demo to prevent 404s in prod.
- Rule engine now covered by table-driven Jest tests using demo scenarios.
- Three detailed fraud scenarios (velocity-breach, bank-swap, geo-mismatch) with rich Stripe event payloads for the Guardian demo.
- TypeScript types and snapshot tests for scenario validation.
- Enhanced ScenarioPicker component with localStorage persistence for remembering the last selected fraud scenario.
- Improved accessibility with shadcn/ui Select component and better keyboard navigation.
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
- Added `notary_leads` Supabase table creation instructions.
- /crondeck product page with hero, pain/solution, features, pricing, Supabase wait-list.
- Added `crondeck_leads` Supabase table creation instructions.
- Supabase Edge Function `send-welcome-email` triggered by new leads.
- Supabase Edge Function `weekly-digest` (cron) to email recent leads.
- Basic HTML email templates for welcome and digest emails.
- SQL for Supabase DB triggers and helper function (`notify_welcome_email`).
- Added `welcome_sent` column to lead tables.
- MDX blog engine (/blog) using `@next/mdx` and `gray-matter`.
- Blog lib helpers (`lib/blog.ts`) for reading/parsing posts.
- Blog index and dynamic post page layouts.
- Tailwind prose styling for blog markdown content.
- JSON‑LD helper (`lib/jsonld.ts`) generating Product and BlogPosting schema.
- Automatic injection of structured data:
  - Product pages: /stripe-guardian, /notary-ci, /crondeck now export `generateMetadata` embedding Product schema.
  - Blog posts dynamically embed BlogPosting schema.
- /guardian-demo route skeleton with hero, placeholder stream panel, noindex meta.
- "View Live Demo" CTA added to Stripe Guardian product page.
- useFakeStripeEvents hook generating realistic Stripe test events.
- Real‑time VelocityChart integrated into /guardian-demo.
- ActionLog and SlackAlert components with auto‑pause narrative integrated into /guardian-demo.
- Installed `stripe` SDK and `@types/stripe-event-types`; added .env.local.example placeholders.
- Edge Stripe webhook endpoint `/api/stripe/webhook` with signature verification and Supabase insert.
- Added `/api/stripe/mock` replay endpoint (auth via `x-demo-key`) for injecting synthetic events.
- Supabase admin client using service role key.
- Rule evaluator utility (`lib/guardian/rules.ts`) with velocity & bank-swap detection + unit tests.
- Added contribution guidelines (`docs/CONTRIBUTING.md`) and PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- Composite CI workflow now runs lint, type-check, Jest (coverage), and Playwright smoke tests across Node 18/20.
- Script for syncing env vars to Vercel and docs; CI guard for missing secrets.
- Lighthouse CI now runs in GitHub Actions after the production build, enforcing a <200 KB JS bundle and LCP <2.5 s budgets. HTML report uploaded as `lhci-report` artifact.
- VS Code workspace settings enable format-on-save; `extensions.json` recommends Prettier, ESLint, Tailwind IntelliSense, Jest, and Docker.
- Improved text contrast to slate-700 body color and added active navigation highlight via data attributes.
- Memoised Intl DateTime & currency formatters via lib/formatters and refactored components to use them.

### Changed

- Used shadcn `Label`

### Fixed

- Renamed `SUPABASE_SERVICE_ROLE` → `SUPABASE_SERVICE_ROLE_KEY` across codebase, environment files, CI, and deployment scripts to prevent runtime errors when writing to Supabase.
- Relaxed Content‑Security‑Policy to include Google Fonts and allow inline scripts for Next.js bootstrap, unblocking Vercel demo pages.
