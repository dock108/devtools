# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.1.0] - 2025-04-21

### Added
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
- MDX blog engine (/blog) via next-mdx + contentlayer.
- Blog index and dynamic post page layouts.
- Tailwind prose styling for blog markdown content.

### Changed
- Used shadcn `Label` component in GuardianWaitlistForm.
- Home grid card for Stripe Guardian now links to /stripe-guardian (no change needed).
- Updated Header component to use a dark background for better logo visibility.
- Card border-radius, shadow, and accent top borders.
- Replaced all Dock108 text references with DOCK108 (uppercase).
- Footer and hero spacing adjustments.
- Simplified homepage layout: removed full-height hero and scroll hint.
- Tailwind theme extended with accent colors (via CSS vars)
- Updated global font to Inter and base body styles
- Updated metadata in root layout
- Refactored `GuardianWaitlistForm` to reusable `WaitlistForm` and updated usage.
- Home grid card and header dropdown now link to /notary-ci (no change needed).
- Home grid card and header dropdown link to /crondeck (no change needed).
- Installed `resend` SDK.
- Added Blog link to main header navigation.

### Fixed
- Lint error: Removed unused `Link` import from `app/page.tsx`.
- Lint error: Removed unused `CardFooter` import from `app/stripe-guardian/page.tsx`.
- Lint errors in `WaitlistForm`: explicit-any, unescaped-entities, unused `PostgrestError` import.

[Unreleased]: https://github.com/dock108/home/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dock108/home/releases/tag/v0.1.0 