'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { AlertNotificationsProvider } from '@/app/context/useAlertNotifications';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a client instance (this ensures a new client for each render on the client)
  // For SSR/SSG stability, useState is preferred if initialized only once.
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {/* TODO: Pass userStripeAccounts if fetched server-side in layout */}
        <AlertNotificationsProvider>{children}</AlertNotificationsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
