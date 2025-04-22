import type { Metadata } from "next";
// Using standard CSS import instead of next/font
import "./globals.css";

export const metadata: Metadata = {
  title: "DOCK108 Home",
  description: "Developer-first tools that solve real dev pain.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Load Inter font using standard link tag */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
