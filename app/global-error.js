'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

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
            We've encountered an error and our team has been notified.
          </p>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </body>
    </html>
  );
}
