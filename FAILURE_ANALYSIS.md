# Failure Analysis

This document details the reasons for test failures identified in the baseline run, proposes minimal fixes, and estimates the effort required.

| Failing Suite Path                             | Failure Reason(s)                                     | Minimal Green Fix                                      | Effort Rating    |
| ---------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| _Multiple Files_ (see list above/logs)         | Vitest `import` used in incompatible CJS context.     | Standardise on Vitest: Remove Jest config/deps,        | ⓷ Rewrite        |
|                                                | Likely caused by conflicting Jest/Vitest configs      | configure `vitest.config.ts` + `tsconfig.json` (ESM    |                  |
|                                                | or incorrect TS module compilation settings.          | output), migrate setup (`jest.setup-env.ts` ->         |                  |
|                                                |                                                       | `vitest.setup.ts`), update all test imports.           |                  |
| tests/rule_sets.spec.ts                        | Fails fetching default rule set                       | Debug fetch logic; ensure Supabase endpoint/mock       | ⓶ Moderate       |
|                                                | (`Error: Failed to fetch... after multiple attempts`) | returns expected rule data.                            |                  |
| tests/guardian/ruleEngine.test.ts              | Supabase RPC error (`PGRST202`): function             | Ensure `insert_alert_and_enqueue` exists in DB schema  | ⓶ Moderate       |
|                                                | `insert_alert_and_enqueue` not found.                 | (migrations) or is correctly mocked.                   |                  |
| tests/feedback.spec.ts                         | `TypeError` (`getSetCookie`, `Invalid URL`) in API    | Standardise on Vitest; properly mock/polyfill          | ⓷ Rewrite        |
|                                                | route handler. Test Request obj lacks properties.     | `Request`, `Response`, `NextResponse`, `next/headers`. | (part of Vitest) |
| tests/retention.spec.ts                        | Supabase insert fails (`PGRST301` / `JWSError`)       | Verify `SUPABASE_SERVICE_ROLE_KEY` & env setup.        | ⓶ Moderate       |
|                                                | Likely auth/config issue with service key.            | Consider mocking DB interactions.                      |                  |
| **tests**/api/contact.test.ts                  | `TypeError` (`getSetCookie`) in API route handler.    | Standardise on Vitest; properly mock/polyfill          | ⓷ Rewrite        |
|                                                | Test Request obj lacks properties.                    | `Request`, `Response`, `NextResponse`, `cookies`.      | (part of Vitest) |
| tests/guardian/customRuleSet.test.ts           | `expect(alerts.length).toBe(1)` fails (received 0).   | Debug test: check `getRuleConfig` mock, input data,    | ⓶ Moderate       |
|                                                | Custom rule set not triggering expected alert.        | rule logic (`velocityBreach`), data mocks.             |                  |
| tests/rules/geoMismatch.test.ts                | Multiple: Logger assertion mismatches, alerts not     | Fix logger assertions & mocking issue (import/setup).  | ⓷ Rewrite        |
|                                                | generated (`toHaveLength(1)` fails), `logger.warn`    | Debug rule logic & data mocks.                         |                  |
|                                                | is not a function error.                              |                                                        |                  |
| tests/rules/velocityBreach.test.ts             | Multiple: Logger assertion mismatches, alerts not     | Fix logger assertions. Debug rule logic & data mocks   | ⓶ Moderate       |
|                                                | generated (`toHaveLength(1)` fails).                  | (`getPayoutsWithinWindow`).                            |                  |
| tests/rules/bankSwap.test.ts                   | Multiple: Logger not called or context mismatch,      | Fix logger assertions. Debug rule logic & data mocks   | ⓶ Moderate       |
|                                                | alerts not generated (`toHaveLength(1)` fails).       | (`findMostRecentExternalAccountChange`).               |                  |
| tests/stripe/webhook.spec.ts                   | Suite fails: `TypeError` logger (`log`) undefined     | Standardise on Vitest; fix logger mocking in setup     | ⓷ Rewrite        |
|                                                | in `app/api/stripe/webhook/route.ts` on import.       | (`vi.mock`) to apply before route import.              | (part of Vitest) |
| app/api/stripe/webhook/**tests**/route.test.ts | Suite fails: `TypeError` logger (`log`) undefined     | Standardise on Vitest; fix logger mocking in setup     | ⓷ Rewrite        |
|                                                | in `app/api/stripe/webhook/route.ts` on import.       | (`vi.mock`) to apply before route import.              | (part of Vitest) |
