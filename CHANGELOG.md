# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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