import { AuthGuard } from "@/components/AuthGuard";
// import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from 'react-hot-toast';

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Remove Header component instance */}
      {/* <Header /> */}
      <main className="flex-grow">
        <AuthGuard>
          {children}
        </AuthGuard>
      </main>
      <Footer />
      <Toaster position="bottom-right" />
    </div>
  );
} 