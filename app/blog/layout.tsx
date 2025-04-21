import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow py-12"> {/* Add padding */}
        {children}
      </main>
      <Footer />
    </div>
  );
} 
 
 
 
 