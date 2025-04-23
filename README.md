# DOCK108 Home

![CI](https://github.com/dock108/devtools/actions/workflows/ci.yml/badge.svg)

Umbrella site for DOCK108 developer tools.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase, and Resend.

## Included Products (v0.1.0)

- **/ (Homepage)**: Overview and links to products.
- **/stripe-guardian**: Stripe Connect payout fraud protection.
  - **/guardian-demo**: Interactive fraud detection demo with scenario selector.
- **/notary-ci**: macOS codesigning & notarization as a service.
- **/crondeck**: Cron job & schedule monitoring.

## Development Environment

- Node.js: v20 (or as specified in `.nvmrc`/`package.json`)
- Supabase Project (for waitlist database)
- Resend Account (for email sending)

## Getting Started

1.  **Environment Variables:**
    Copy `.env.example` (if created) or create `.env.local` and add your Supabase and Resend keys:

    ```
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    RESEND_API_KEY=...
    FROM_EMAIL=...
    # Optional: For local Supabase CLI function testing
    # SUPABASE_SERVICE_ROLE_KEY=...
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

If you're working with the Stripe Guardian component, you'll need to set up the database schema:

1. **Start Supabase Local Development:**

   ```bash
   pnpm supabase start
   ```

2. **Apply Migrations:**
   ```bash
   supabase db reset
   ```

This will create all required tables (connected_accounts, payout_events, alerts) and seed initial test data.

## Available Scripts

- `npm run dev`: Starts the development server.
- `npm run lint`: Lints the codebase using Next.js ESLint config.
- `npm run format`: Formats code using Prettier.
- `npm run build`: Creates an optimized production build.
- `npm start`: Starts the production server (requires `npm run build` first).
- `npm test`: Runs Jest unit tests.
- `npm run test:e2e`: Runs Playwright smoke tests against key marketing pages.

## Testing

### Unit Tests

Unit tests use Jest and can be run with `npm test`.

### End-to-End Tests

We use Playwright for lightweight smoke tests that verify our key marketing pages load correctly:

```bash
# Run in headless mode
npm run test:e2e

# Run in debug mode with browser UI
PWDEBUG=1 npm run test:e2e
```

See `/tests/e2e/README.md` for more details on e2e tests.

## Deployment

This project is intended for deployment on Vercel. Ensure environment variables for Supabase and Resend are set in the Vercel project settings.

Supabase Edge Functions (`send-welcome-email`, `weekly-digest`) need to be deployed separately using the Supabase CLI and database triggers/cron schedules configured in the Supabase dashboard.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on how to get started, branch naming, commit formatting, and the PR process.

## Interactive Demos

### Guardian Demo

The Stripe Guardian demo (/guardian-demo) showcases fraud detection in action:

- **Scenario Selection**: Choose from predefined fraud scenarios (velocity breach, bank swap, geo-mismatch) using the dropdown.
- **Persistence**: Your selected scenario is remembered across page reloads via localStorage.
- **Playback Controls**: Restart, loop, and adjust playback speed of scenarios.
- **Real-time Visualization**: Watch events appear in the timeline and see fraud patterns emerge.

To add custom scenarios:

1. Add new JSON files in `app/guardian-demo/scenarios/` following the format in the existing files
2. Update the list of scenarios in `app/guardian-demo/getScenarios.ts`
