import * as Sentry from '@sentry/nextjs';
import { ProfilingIntegration } from '@sentry/profiling-node';
// import { RequestError } from 'next/dist/server/request-error'; // Original: Unresolved

export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

// Add onRequestError hook to capture request errors
export function onRequestError({
  request,
  error,
}: {
  request: NextRequest;
  error: RequestError;
}): void {
  Sentry.captureRequestError({ request, error });
}
