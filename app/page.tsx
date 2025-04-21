import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="container mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col items-start justify-center px-4 text-left">
          <h1 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
            Developer-first tools that solve real dev pain.
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            From fraud protection to flawless builds, Dock108 ships the fixes you need.
          </p>
          <Link href="/#products" className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="h-6 w-6 text-muted-foreground" />
            <span className="sr-only">Scroll to products</span>
          </Link>
        </section>

        {/* Product Grid Section */}
        <section id="products" className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold">Our Products</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <ProductCard
              title="Stripe Guardian"
              blurb="Stop fraudulent payouts before they reach the bank."
              href="/stripe-guardian"
              accent="guardian"
            />
            <ProductCard
              title="Notary CI"
              blurb="Automated release notarization for macOS apps in CI/CD."
              href="/notary-ci"
              accent="notary"
            />
            <ProductCard
              title="Crondeck"
              blurb="Reliable, observable cron job monitoring and scheduling."
              href="/crondeck"
              accent="crondeck"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
