import { Metadata } from 'next';
import { Container } from '@/components/Container';
import { ShieldCheck, Zap, Check, Settings, Gauge, Users, Sparkles, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { GuardianIcon } from '@/components/GuardianIcon';
import { cn } from '@/lib/utils';
import { productLD } from '@/lib/jsonld';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Reusable Badge component (Minor style tweak for Beta badge)
const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', // Adjusted padding/size
      className,
    )}
  >
    {children}
  </span>
);

// Guardian illustration for hero (larger icon)
const HeroGuardianIllustration = ({ className }: { className?: string }) => (
  <GuardianIcon
    className={cn(
      'h-[24rem] w-[24rem] stroke-[2] text-[var(--accent-guardian)] drop-shadow-xl',
      className,
    )}
  />
);

// Metadata
export const generateMetadata = (): Metadata => {
  const url = 'https://www.dock108.ai/stripe-guardian';
  const image = `${url}/opengraph-image`;
  const description =
    'Real-time fraud protection for Stripe Connect platforms. Monitor payouts 24/7 and stop suspicious activity before funds leave your account.';

  return {
    title: 'Stripe Guardian – Real-Time Payout Fraud Protection | DOCK108',
    description: description,
    openGraph: {
      title: 'Stripe Guardian – Real-Time Payout Fraud Protection | DOCK108',
      description: description,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Stripe Guardian – Real-Time Payout Fraud Protection | DOCK108',
      description: description,
      images: [image],
    },
    other: {
      'script:type=application/ld+json': JSON.stringify(
        productLD({
          name: 'Stripe Guardian',
          description: 'Real‑time velocity rules, bank‑swap detection & auto‑pause.',
          url,
          image,
          price: '29.00',
        }),
      ),
    },
  };
};

const painPoints = [
  {
    pain: 'Rogue Express accounts appear overnight, draining funds before you notice.',
    fix: 'Webhook diff analysis flags new accounts, IP geolocation changes, and unusual setup velocity.',
  },
  {
    pain: 'Instant payouts enabled? A single compromised account can mean $10K+ lost in hours.',
    fix: 'Configurable velocity limits per account and platform-wide, with instant auto-pause actions.',
  },
  {
    pain: "Stripe Radar rules aren\'t built for nuanced platform payout fraud like bank swapping.",
    fix: 'Pre-built heuristics tuned for SaaS & marketplace payout patterns, including bank account swap detection.',
  },
];

const features = [
  {
    name: 'Comprehensive Fraud Detection',
    description:
      'Utilizes multiple heuristics like velocity checks, bank swap detection, and geo-location analysis.',
    icon: ShieldCheck,
  },
  {
    name: 'Real-Time Alerts & Notifications',
    description:
      'Get instant notifications via email or Slack when suspicious activity is detected.',
    icon: Zap,
  },
  {
    name: 'One-Click Stripe Connect Onboarding',
    description: 'Securely connect your Stripe account in seconds via OAuth.',
    icon: Sparkles,
  },
  {
    name: 'Intelligent Risk Scoring',
    description: 'Alerts are assigned a risk score based on rule weights and historical feedback.',
    icon: Gauge,
  },
  {
    name: 'Customizable Rules & Thresholds',
    description: 'Fine-tune detection sensitivity with adjustable rule parameters (coming soon).',
    icon: Settings,
  },
  {
    name: 'Admin Dashboard & Team Access',
    description: 'Monitor alerts, manage settings, and invite team members (coming soon).',
    icon: Users,
  },
];

// Pricing tiers data (placeholder)
const tiers = [
  {
    name: 'Beta Free',
    id: 'tier-beta-free',
    priceLabel: '$0',
    priceSubLabel: 'during beta',
    description: 'Get started for free during our public beta phase.',
    features: [
      'Up to 2 Stripe accounts',
      'Core fraud detection rule set',
      'Default rule thresholds',
      'Email & Slack alerts',
      'Manual alert response',
      '30-day data retention',
      'Community support',
    ],
    cta: 'Join the Free Beta',
    ctaLink: '/sign-up',
    isPrimary: true,
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    priceLabel: 'Coming Soon',
    priceSubLabel: 'Subscription',
    description: 'Advanced features and unlimited scale for established platforms.',
    features: [
      'Unlimited connected accounts',
      'Advanced rule customization',
      'Multi-channel alerts',
      'Auto-pause options',
      '60+ day data retention',
      'Priority support',
    ],
    cta: 'Notify Me',
    ctaLink: '#',
    isPrimary: false,
  },
];

// New Benefits Section Data
const benefits = [
  {
    name: 'Prevent Fraud Losses Proactively',
    description:
      'Stop suspicious payouts automatically before funds are lost. Guardian acts as your first line of defense against common platform payout fraud vectors.',
    icon: ShieldCheck,
  },
  {
    name: 'Save Time & Reduce Alert Fatigue',
    description:
      'Focus on real threats. Our intelligent risk scoring and targeted alerts minimize noise, letting your team investigate what matters most.',
    icon: Eye,
  },
  {
    name: 'Easy Setup—No Maintenance',
    description:
      'Connect your Stripe account in minutes. Guardian runs securely in the cloud with no complex setup or ongoing maintenance required from your team.',
    icon: Sparkles,
  },
];

export default function StripeGuardianPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden pt-14">
        <Container className="py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:py-40">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div className="flex items-center gap-x-4">
              <Badge className="border border-blue-200 bg-blue-50 text-blue-700">💡 Beta</Badge>
              <span className="text-sm font-medium text-gray-600">Now in Public Beta!</span>
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Guard Your Stripe Payouts with Stripe Guardian.
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Real-time fraud protection for Stripe Connect platforms. Monitor payouts 24/7 and stop
              suspicious activity before funds leave your account.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center gap-x-6 gap-y-4">
              <Button asChild size="lg">
                <Link href="/sign-up">Join the Free Beta</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/guardian-demo">View Demo</Link>
              </Button>
            </div>
          </div>
          {/* Guardian Illustration */}
          <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-shrink-0 lg:flex-grow">
            <HeroGuardianIllustration className="mx-auto" />
          </div>
        </Container>
        {/* Background Gradient (Optional Subtle effect) */}
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[var(--accent-guardian)] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
      </div>

      {/* Pain/Solution Section */}
      <div className="py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Tired of payout fraud hitting your bottom line?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Guardian acts as your automated fraud team, catching suspicious activity missed by
              default Stripe rules.
            </p>
          </div>
          <div className="mt-16 flow-root">
            <div className="-my-8 divide-y divide-gray-100">
              {painPoints.map((point, index) => (
                <div
                  key={index}
                  className={`py-8 ${index % 2 !== 0 ? 'bg-gray-50 -mx-6 px-6 lg:-mx-8 lg:px-8' : ''}`}
                >
                  <dl className="relative flex flex-wrap gap-x-3 gap-y-3 lg:gap-x-8">
                    <div className="flex-none lg:w-80">
                      <dt className="font-semibold text-gray-900">The Pain:</dt>
                      <dd className="mt-1 text-gray-600">{point.pain}</dd>
                    </div>
                    <div className="flex-auto">
                      <dt className="font-semibold text-gray-900">The Guardian Fix:</dt>
                      <dd className="mt-1 text-gray-600">{point.fix}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>

      {/* Benefits Section - Added */}
      <div className="bg-white py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-[var(--accent-guardian)]">
              Protect Your Platform
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Focus on growth, not fraud management
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Guardian provides automated protection, intelligent alerting, and peace of mind,
              freeing up your team.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
              {benefits.map((benefit) => (
                <div key={benefit.name} className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-gray-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-guardian)]">
                      <benefit.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    {benefit.name}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-gray-600">{benefit.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-[var(--accent-guardian)]">
              How It Works
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to fight payout fraud
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Guardian integrates seamlessly with Stripe Connect to provide multiple layers of
              defense.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none md:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
              {features.map((feature) => (
                <div key={feature.name} className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-gray-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-guardian)]">
                      <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </div>

      {/* Pricing Section */}
      <div className="bg-white py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-[var(--accent-guardian)]">
              Public Beta Pricing
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Free during Beta
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Get full access to core Guardian features while we gather feedback. Pro plan coming
              soon.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 lg:max-w-4xl lg:grid-cols-2 lg:gap-x-8 lg:gap-y-0">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={cn(
                  'flex flex-col justify-between rounded-3xl p-8 ring-1 ring-gray-200 xl:p-10',
                  tier.isPrimary ? 'bg-gray-900 ring-gray-900' : 'bg-white',
                )}
              >
                <div>
                  <h3
                    className={cn(
                      'text-lg font-semibold leading-8',
                      tier.isPrimary ? 'text-white' : 'text-gray-900',
                    )}
                  >
                    {tier.name}
                  </h3>
                  <p
                    className={cn(
                      'mt-4 text-sm leading-6',
                      tier.isPrimary ? 'text-gray-300' : 'text-gray-600',
                    )}
                  >
                    {tier.description}
                  </p>
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span
                      className={cn(
                        'text-4xl font-bold tracking-tight',
                        tier.isPrimary ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      {tier.priceLabel}
                    </span>
                    {tier.priceSubLabel && (
                      <span
                        className={cn(
                          'text-sm font-semibold leading-6 tracking-wide',
                          tier.isPrimary ? 'text-gray-300' : 'text-gray-600',
                        )}
                      >
                        {tier.priceSubLabel}
                      </span>
                    )}
                  </p>
                  <ul
                    role="list"
                    className={cn(
                      'mt-8 space-y-3 text-sm leading-6',
                      tier.isPrimary ? 'text-gray-300' : 'text-gray-600',
                    )}
                  >
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <Check
                          className={cn(
                            'h-6 w-5 flex-none',
                            tier.isPrimary ? 'text-white' : 'text-[var(--accent-guardian)]',
                          )}
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  asChild
                  className={cn(
                    'mt-8',
                    !tier.isPrimary &&
                      'bg-[var(--accent-guardian)] hover:bg-[var(--accent-guardian)]/90',
                  )}
                  variant={tier.isPrimary ? 'outline' : 'default'}
                >
                  <Link href={tier.ctaLink}>{tier.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </Container>
      </div>

      {/* Footer CTA Section - Updated with sub-text */}
      <div className="bg-gray-50 py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Ready to secure your Stripe payouts?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Join the free beta today. Setup takes less than 5 minutes, no credit card required.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-4">
              <Button asChild size="lg">
                <Link href="/sign-up">Start Free Beta</Link>
              </Button>
              <Link
                href="/guardian-demo"
                className="text-sm font-semibold leading-6 text-gray-900 hover:text-[var(--accent-guardian)]"
              >
                View Demo <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
