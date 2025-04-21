import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {children}
      <Footer />
    </div>
  );
} 
 