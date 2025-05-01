'use client';

import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
} 