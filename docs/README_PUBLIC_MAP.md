# Public Documentation Map

This document maps internal documentation to public-facing documentation and outlines what content has been redacted for the public docs site.

## Source → Destination Map

| Public Guide                                              | Source File                                               | Status      | Notes / Redaction                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| Getting Started<br>`content/docs/getting-started.mdx`     | `docs/guardian/onboarding.md`                             | ✅ Complete | Removed CLI commands; kept OAuth flow description but simplified diagrams.                                   |
| How Alerts Work<br>`content/docs/alerts.mdx`              | `docs/guardian/alerts.md`                                 | ✅ Complete | Deleted entire "DB Schema" section. Replaced code block with paragraph: "Guardian stores minimal metadata…". |
| Rules & Risk Scoring<br>`content/docs/rules-and-risk.mdx` | `docs/guardian/rules.md`<br>`docs/guardian/risk-score.md` | ✅ Complete | Merged the source files; stripped rule-weight table values to use generic ranges.                            |
| Notifications<br>`content/docs/notifications.mdx`         | `docs/guardian/notifications.md`                          | ✅ Complete | Removed Resend payload JSON; kept email screenshot description but used placeholder path.                    |
| FAQ<br>`content/docs/faq.mdx`                             | New file                                                  | ✅ Complete | Created fresh FAQ from Slack support threads and legacy README.                                              |

## Redaction Rules

The following content has been systematically removed from public docs:

- ❌ SQL statements (CREATE TABLE, ALTER TABLE, etc.)
- ❌ Supabase policy code or RPC calls
- ❌ Full JSON webhook payloads
- ❌ ER diagrams or detailed schema information
- ❌ Environment variable values (masked with \*\*\*\*)

## Validation Process

All documentation files have been validated with:

1. **docs:lint**: Script that checks for sensitive content patterns
2. **check:links**: Verifies all internal and external links work
3. **Manual review**: Code reviewers should check for any missed sensitive information

## Public Documentation Structure

The public documentation site uses the following structure in `lib/docs.config.ts`:

```js
export const docsNav = [
  {
    heading: 'Start',
    links: [{ title: 'Getting Started', slug: 'getting-started' }],
  },
  {
    heading: 'Concepts',
    links: [
      { title: 'How Alerts Work', slug: 'alerts' },
      { title: 'Rules & Risk Scoring', slug: 'rules-and-risk' },
    ],
  },
  {
    heading: 'Operations',
    links: [
      { title: 'Notifications', slug: 'notifications' },
      { title: 'FAQ', slug: 'faq' },
    ],
  },
];
```

## Testing

The documentation is tested via:

- **Unit tests**: Verify that getAllDocs() returns at least 5 slugs
- **Lint test**: Ensures no sensitive content is included
- **Link checking**: Verifies all links are valid
- **E2E tests**: Playwright tests for the documentation site
- **Bundle size**: Ensures docs add <1MB to the bundle

## Future Updates

When adding new documentation:

1. Create the MDX file in `content/docs/`
2. Update `lib/docs.config.ts` with the new entry
3. Run the validation scripts (`npm run docs:lint` and `npm run check:links`)
4. Verify the content doesn't include sensitive information
5. Submit for review
