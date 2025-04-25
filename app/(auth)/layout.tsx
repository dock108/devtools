import { AuthGuard } from '@/components/AuthGuard';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="flex-grow min-h-screen">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </>
  );
} 