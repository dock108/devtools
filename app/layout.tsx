import type { Metadata } from "next";
// Using standard CSS import instead of next/font
import "./globals.css";
// Removed Prism theme CSS import as Prism is no longer used
// import "prism-themes/themes/prism-vsc-dark-plus.css"; 
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "DOCK108 Home",
  description: "Developer-first tools that solve real dev pain.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Font preconnects removed as we're using self-hosted Inter */}
      </head>
      <body>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <div className="font-sans bg-background text-foreground antialiased flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            <Toaster position="bottom-right" />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
