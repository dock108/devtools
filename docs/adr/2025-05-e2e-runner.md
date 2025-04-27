# ADR: Consolidate End-to-End Testing Tool

- **Status**: Proposed
- **Date**: 2025-05-16
- **Deciders**: @mike-fuscoletti (via AI Engineer prompt)
- **Consulted**: AI Engineer
- **Affected**: CI Workflows, `package.json`, Documentation

## Context and Problem Statement

The repository previously exhibited signs of using both Playwright and Cypress for end-to-end testing:

- `ci.yml` explicitly ran Playwright tests (`npm run test:e2e` -> `playwright test`).
- `staging.yml` ran `npm run test:e2e` (Playwright) but contained leftover configuration referencing Cypress (e.g., `CYPRESS_BASE_URL` env var, `Upload Cypress artifacts` step).
- This inconsistency caused confusion, potential for drift, and unnecessary configuration in CI workflows.

We need a single, clearly defined E2E testing tool and strategy.

## Decision Drivers

- **Reduce Complexity**: Maintaining configuration and potentially tests for two E2E frameworks is inefficient.
- **CI Performance**: Avoid installing/caching dependencies for unused tools.
- **Consistency**: A single tool provides a clearer developer experience and CI setup.
- **Existing Usage**: Playwright is already used in the primary `ci.yml` workflow and is the target of the `npm run test:e2e` script used by `staging.yml`.

## Considered Options

1.  **Standardize on Playwright**: Remove all traces of Cypress and ensure all E2E tests run via Playwright.
2.  **Standardize on Cypress**: Migrate existing Playwright tests to Cypress, update CI.
3.  **Keep Both**: Justify the need for both tools and establish clear guidelines/configurations.

## Decision

We will standardize on **Playwright** as the sole end-to-end testing framework for this repository.

Playwright is already the primary tool used in CI and the target of the main `test:e2e` script. No active Cypress tests were found, only leftover configuration artifacts. Consolidating on Playwright aligns with existing usage and simplifies the setup.

## Consequences

- **Removal of Cypress**: Cypress dependencies will be removed from `package.json`. Any leftover Cypress configuration files (`cypress/`, `cypress.config.ts`, etc.) will be deleted.
- **CI Workflow Simplification**: The `staging.yml` workflow will be cleaned up to remove Cypress-specific environment variables and artifact steps.
- **Documentation Updates**: README and any contributing guides will be updated to reflect Playwright as the single E2E tool.
- **Test Migration**: No test migration is required as no active Cypress tests were identified.
- **Potential Skill Gap**: Team members unfamiliar with Playwright may need time to adapt (if any were solely focused on the presumed Cypress setup).
