# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Updated Header component to use a dark background for better logo visibility.
- Card border-radius, shadow, and accent top borders.
- Replaced all Dock108 text references with DOCK108 (uppercase).
- Footer and hero spacing adjustments.
- Simplified homepage layout: removed full-height hero and scroll hint.
- Tailwind theme extended with accent colors (via CSS vars)
- Updated global font to Inter and base body styles
- Updated metadata in root layout 