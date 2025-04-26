# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Per-account OAuth token support (`tokens.json`) so the seeder can inject `external_account.created` (bank-swap) events on Standard connected accounts using the Test Helpers API.
- Dual-connect onboarding page: users can now choose Express (Account Link) or Standard (OAuth) when linking a Stripe account. (@YourGitHubUsername)

### Fixed
- Replaced Stripe CLI fixture step with Test Helpers API calls; scenario burst now works on Standard connected accounts without permission errors or CLI issues.

### Changed
* Seeder now writes one random fraud alert directly to Supabase each hour; removed all Stripe dependencies and charge/payout noise. (@YourGitHubUsername)

### Removed
* Removed `stripe` python library dependency and related code.
* Removed `timewarp_seeder.py` script. 