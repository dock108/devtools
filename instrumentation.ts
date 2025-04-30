import { RequestError } from 'next/dist/server/request-error'; // Original: Unresolved
import { NextRequest } from 'next/server';

export function register() {
  // Sentry.init removed
}

// Add onRequestError hook to capture request errors
// export function onRequestError({
//   request,
//   error,
// }: {
//   request: NextRequest;
//   error: RequestError;
// }): void {
//   // Sentry.captureRequestError({ request, error });
// }
