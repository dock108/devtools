import type { Metadata } from 'next';
// Using standard CSS import instead of next/font
import './globals.css';
// Removed Prism theme CSS import as Prism is no longer used
// import "prism-themes/themes/prism-vsc-dark-plus.css";
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/theme-provider';
// Import the AlertNotificationsProvider
import { AlertNotificationsProvider } from '@/app/context/useAlertNotifications';

export const metadata: Metadata = {
  title: 'DOCK108 Home',
  description: 'Developer-first tools that solve real dev pain.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: Fetch userStripeAccounts server-side here if possible/needed for the provider
  // For now, we pass an empty array or let the provider fetch them internally
  // const userStripeAccounts = await fetchUserAccounts();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>{/* Google Font preconnects removed as we're using self-hosted Inter */}</head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Wrap the main layout content with the Alert provider */}
          {/* Pass userStripeAccounts if fetched server-side */}
          <AlertNotificationsProvider /* userStripeAccounts={userStripeAccounts} */>
            <div className="font-sans bg-background text-foreground antialiased flex flex-col min-h-screen">
              <Header />
              <main className="flex-grow">{children}</main>
              <Footer />
              <Toaster position="bottom-right" />
            </div>
          </AlertNotificationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
