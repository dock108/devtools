import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-grow min-h-screen">
        <AuthGuard>{children}</AuthGuard>
      </main>
      <Footer />
    </>
  );
} 