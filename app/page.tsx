import { ProductCard } from '@/components/ProductCard';
import { Container } from '@/components/Container';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate pt-16 pb-8 md:pt-24">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 right-1/2 h-[36rem] w-[72rem] translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-sky-400/20 via-purple-400/20 to-rose-400/20 blur-3xl" />
        </div>
        <Container className="flex max-w-3xl flex-col items-start justify-center text-left sm:pt-20">
          <h1 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
            Developer-first tools that solve real dev pain.
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            From fraud protection to flawless builds, DOCK108 ships the fixes you need.
          </p>
        </Container>
      </section>

      {/* Product Grid Section */}
      <section id="products" className="pb-16 pt-8">
        <Container>
          <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:gap-y-12 md:grid-cols-2 lg:grid-cols-3">
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
        </Container>
      </section>
    </>
  );
}
