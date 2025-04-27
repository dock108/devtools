// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = !!SENTRY_DSN;

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Adjust this value in production, or use tracesSampler for finer control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    // debug: false,
    environment: process.env.NODE_ENV || 'development',
    // release: process.env.VERCEL_GIT_COMMIT_SHA, // Example for Vercel
  });
  console.log('[Sentry] Edge SDK initialized');
} else {
  console.log('[Sentry] Edge SDK not initialized (SENTRY_DSN not set)');
}
