'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log the error to the console
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
          <p className="mb-8 text-gray-600">
            We&apos;ve encountered an error and our team has been notified.
          </p>
          <button
            onClick={() => {
              Sentry.captureException(error);
            }}
            className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/80"
          >
            It&apos;s not you, it&apos;s us. Try again?
          </button>
        </div>
      </body>
    </html>
  );
}
