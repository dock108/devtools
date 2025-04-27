import React from 'react';

// This layout applies only to the /blog routes
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  // We don't include Header, Footer, or BlogFooterSnippets here.
  // The root layout already provides the main structure (html, body, providers, header, footer).
  // This layout simply passes the children through, preventing the BlogFooterSnippets
  // from the root layout being applied *again* or allowing us to specifically omit it.
  // However, nested layouts *replace*, they don't merge easily by default.
  // A simpler approach might be needed if this doesn't work as expected.

  // Let's actually just return the children. The root layout will handle the rest.
  // If BlogFooterSnippets still appears, we need a different strategy.
  return <>{children}</>;
}
