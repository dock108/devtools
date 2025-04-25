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
    Copy `.env.example` to `.env.local` and add your Supabase, Stripe, and Resend keys:

    ```
    # See .env.example for all required variables
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    RESEND_API_KEY=...
    STRIPE_CLIENT_ID=...
    STRIPE_SECRET_KEY=...
    # Additional variables needed for specific features
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

4.  **For Stripe Guardian Development:**
    If you're working with Stripe Guardian features, see [Guardian Local Development](./docs/guardian/local-dev.md) for detailed instructions on setting up Stripe Connect OAuth and webhooks locally.

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

## 🚀 Deploying to Vercel

1. Duplicate `.env.example` → `.env` and fill in the required secrets.
2. Push the secrets to Vercel:

```bash
pnpm vercel:env
```

3. Deploy the app:

```bash
vercel --prod
```

The script will fail fast if any required secret is missing locally.

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

## Running Lighthouse locally

After building the production bundle, you can run Lighthouse CI against key routes:

```bash
pnpm build && pnpm lh-ci
# Reports are saved in .lighthouseci/index.html
```

## Accessibility

All body text meets WCAG AA contrast (≥4.5:1) against white using slate‑700. Primary navigation uses `data-current` attribute to render a bold, underlined state for the active page without extra JavaScript.

## Alpha Access

During the closed alpha phase, access to the application is restricted to a pre-approved list of email addresses.

To add new testers:

1. Add their email to the `ALPHA_ALLOW_LIST` environment variable in your Vercel settings
2. Multiple emails should be comma-separated:
   ```
   ALPHA_ALLOW_LIST=alice@example.com,bob@company.co,charlie@startup.io
   ```
3. Deploy the changes
4. Share the login URL with your testers

Users not on the allow list will be unable to sign up and will be prompted to contact `beta@dock108.ai` for access.

## Deploy checklist

When applying database migrations:

1. **Apply migrations locally first**

   ```bash
   supabase db push            # run once on your machine
   git add supabase/migrations
   git commit -m "chore(db): new migration"
   git push origin main       # Vercel build will skip db push
   ```

2. **Verify deployment**
   - Confirm Vercel build log no longer mentions "Connecting to remote database…"
   - Verify application functionality to ensure tables and triggers are working

Note: Vercel builds no longer run `supabase db push`. All migrations must be applied locally or through Supabase Studio before pushing code.

## Local development

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Copy `.env.example` to `.env.local` and fill in your API keys (Supabase, Stripe, Resend):
    ```bash
    cp .env.example .env.local
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

### Running tests

```bash
# Run in headless mode
npm run test:e2e

# Run in debug mode with browser UI
PWDEBUG=1 npm run test:e2e
```

See `/tests/e2e/README.md` for more details on e2e tests.
