# Test Issues Summary (First Pass)

This document summarizes the general issues identified across skipped tests during the initial pass.

## Configuration/Environment Conflicts

### Jest/Vitest Configuration Conflict

_Affected Files:_

- `tests/lib/stripe.test.ts`
- `tests/components/guardian-demo/Countdown.test.tsx`
- `tests/components/guardian-demo/ScenarioPicker.test.tsx`
- `tests/app/guardian-demo/useDemoScenario.timers.test.ts`
- `tests/app/guardian-demo/useDemoScenario.test.ts`
  _Issue:_ Persistent `Vitest cannot be imported in a CommonJS module using require()` error when running Vitest tests, possibly due to interactions between Jest/Vitest configs or transformers, especially after moving files.

### Logger Mocking Issue

_Affected Files:_

- `tests/perf.spec.ts`
- `tests/scenarios.spec.ts`
- `tests/app/api/stripe/webhook/route.test.ts`
  _Issue:_ Tests fail due to logger instances (`log.info`, etc.) not being defined or mocked correctly in the test environment, particularly when importing API routes or modules that log at the top level.

### Next.js API Route Mocking

_Affected Files:_

- `tests/feedback.spec.ts`
- `tests/api/contact.test.ts`
  _Issue:_ Unresolved problems mocking or interacting with Next.js API route handlers within the test environment.

### E2E Setup Complexity

_Affected Files:_

- `tests/e2e/smoke.spec.ts`
- `tests/e2e/docs.test.ts`
  _Issue:_ Challenges related to Playwright setup, including web server startup timeouts, dynamic port handling, and potentially environment variables.

### Environment Variables Required

_Affected Files:_

- `tests/reactor.spec.ts` (Requires SUPABASE\_\*)
- `tests/stripe/oauth.test.ts` (Requires SUPABASE*URL, SUPABASE_ANON_KEY - identified after removing `.skip`)
  \_Issue:* Tests depend on specific environment variables that are not configured or injected into the test environment.

### Other Environment/Dependency Issues

_Affected Files:_

- `tests/alert-dispatch.integration.test.ts` (Deno dependency / URL import issue)
- `tests/backfill.spec.ts` (Uses EdgeRuntime, blocked by polyfill issue)
- `tests/admin/notification-channels.test.tsx` (Dropdown/dialog interaction issues - likely related to testing UI components with specific states/interactions)
- `tests/notify.spec.ts` (Marked as Vitest/Jest incompatibility)

## External Service Dependencies

### Supabase Connection/Data

_Affected Files:_

- `tests/risk_score.spec.ts` (Requires live Supabase)
- `tests/rule_sets.spec.ts` (Requires live Supabase with data)
- `tests/retention.spec.ts` (Requires live/local Supabase)
- `tests/db/rls.spec.ts` (Requires specific test users in local Supabase)
  _Issue:_ Tests require a running Supabase instance (local or live) with specific data or user configurations.

## Test Code Structure/Completeness

### Needs Test Structure/Mocks

_Affected Files:_

- `tests/scripts/generate-rss.test.ts` (Originally a script, needs test structure/mocks)
  _Issue:_ Files moved into `tests` were originally source code or runnable scripts, lacking test suites (`describe`/`it`) and necessary mocks.

### Intentionally Skipped (`describe.skip`)

_Affected Files:_

- `tests/waitlist.test.ts` (Original reason: stabilization/functionality issues)
- `tests/routes/oauth-callback.test.ts` (Original reason: Unimplemented)
  _Issue:_ Tests explicitly skipped in the source code.

### Incomplete Tests (TODOs)

_Affected Files:_

- `tests/app/dashboard/accounts/ConnectedAccountsManager.test.tsx` (Contains TODOs/placeholders, `describe.skip` was removed)
  _Issue:_ Tests were likely skipped (`describe.skip`) because they were incomplete.

## Investigation Needed

- `tests/stripe/webhook.spec.ts`: Skipped, but the specific reason was not investigated during this pass.
- `tests/e2e/contact.test.ts`: Not yet run during this pass.
