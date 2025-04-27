import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { RequestError } from 'next/dist/server/request-error';

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
