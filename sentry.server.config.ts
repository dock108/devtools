// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = !!SENTRY_DSN;

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Adjust this value in production, or use tracesSampler for finer control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    // Set profilesSampleRate to 1.0 to profile 100% of transactions:
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    // ... add any other server-specific Sentry options here
    environment: process.env.NODE_ENV || 'development',
    // release: process.env.VERCEL_GIT_COMMIT_SHA, // Example for Vercel
  });
  console.log('[Sentry] Server SDK initialized');
} else {
  console.log('[Sentry] Server SDK not initialized (SENTRY_DSN not set)');
}
