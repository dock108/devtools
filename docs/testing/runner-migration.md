# Test Runner Migration

## Standardization on Jest

This project uses **Jest** as its sole JavaScript test runner.

Previously, some tests were written using Vitest. To ensure consistency, reduce configuration complexity, and simplify the CI process, all tests were migrated to Jest, or identified for migration.

The key reasons for choosing Jest include:

- **Maturity and Ecosystem:** Jest has a large community, extensive documentation, and broad support across libraries and tools.
- **Existing Configuration:** A Jest configuration (`jest.config.cjs`, `jest.setup-env.ts`) was already present and partially in use.
- **Developer Familiarity:** (Assume team familiarity or preference if applicable)

The migration involved:

- Replacing Vitest imports (`import ... from 'vitest'`) with Jest imports (`import ... from '@jest/globals'`).
- Converting Vitest-specific APIs (`vi.fn`, `vi.mock`) to their Jest equivalents (`jest.fn`, `jest.mock`).
- Addressing configuration issues related to module resolution (e.g., path aliases, ESM packages like `uuid`) within `jest.config.cjs`.
- Handling environment differences (e.g., missing Web APIs like `TextEncoder`, `TextDecoder`) via polyfills, typically added to `jest.setup-env.ts`.

Ongoing efforts focus on resolving remaining test failures, which are now related to application logic, mocking strategies, or environment setup within the Jest context, rather than runner conflicts.
