// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN; // Use NEXT_PUBLIC_ prefix for client-side env vars
const SENTRY_ENABLED = !!SENTRY_DSN;

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Adjust this value in production, or use tracesSampler for finer control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    // debug: false,
    replaysOnErrorSampleRate: 1.0,
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,
    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    environment: process.env.NODE_ENV || 'development',
    // release: process.env.VERCEL_GIT_COMMIT_SHA, // Example for Vercel
  });
  console.log('[Sentry] Client SDK initialized');
} else {
  console.log('[Sentry] Client SDK not initialized (NEXT_PUBLIC_SENTRY_DSN not set)');
}
