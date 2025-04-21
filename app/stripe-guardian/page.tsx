import type { Metadata } from 'next';
import { Container } from '@/components/Container'; // Import Container
import { Zap, Gauge, ShieldCheck, Banknote, SlidersHorizontal, AlertTriangle } from 'lucide-react'; // Import icons
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Removed unused CardFooter
import { Check } from 'lucide-react';
import { WaitlistForm } from '@/components/WaitlistForm'; // Use refactored form
import { GuardianIcon } from '@/components/GuardianIcon';
import { cn } from '@/lib/utils';

// Placeholder components
const Badge = ({ children, colorVar }: { children: React.ReactNode, colorVar: string }) => (
  <span 
    className="inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium"
    style={{ backgroundColor: `color-mix(in srgb, ${colorVar} 10%, transparent)`, color: colorVar }}
  >
    {children}
  </span>
);

// Guardian illustration for hero (larger icon)
const HeroGuardianIllustration = ({ className }: { className?: string }) => (
  <GuardianIcon className={cn('h-[24rem] w-[24rem] stroke-[2] text-[var(--accent-guardian)] drop-shadow-xl', className)} />
);

// Metadata
export const metadata: Metadata = {
  title: 'Stripe Guardian – Stop Express payout fraud | DOCK108',
  description: 'Real-time protection for Stripe Connect platforms.',
  openGraph: { 
    title: 'Stripe Guardian – Stop Express payout fraud | DOCK108', // Consistent title 
    description: 'Real-time protection for Stripe Connect platforms.', // Add description
    url: '/stripe-guardian',
    images: ['/stripe-guardian/opengraph-image'],
  },
  twitter: { // Add Twitter card data
    card: 'summary_large_image',
    title: 'Stripe Guardian – Stop Express payout fraud | DOCK108',
    description: 'Real-time protection for Stripe Connect platforms.',
    images: ['/stripe-guardian/opengraph-image'],
  }
};

const painPoints = [
  {
    pain: "Rogue Express accounts appear overnight, draining funds before you notice.",
    fix: "Webhook diff analysis flags new accounts, IP geolocation changes, and unusual setup velocity.",
  },
  {
    pain: "Instant payouts enabled? A single compromised account can mean $10K+ lost in hours.",
    fix: "Configurable velocity limits per account and platform-wide, with instant auto-pause actions.",
  },
  {
    pain: "Stripe Radar rules aren\'t built for nuanced platform payout fraud like bank swapping.",
    fix: "Pre-built heuristics tuned for SaaS & marketplace payout patterns, including bank account swap detection.",
  },
];

const features = [
  {
    name: 'Real-time Webhook Monitoring',
    description: 'Instantly analyze connect.account.updated and other critical webhooks for suspicious changes.',
    icon: Zap,
  },
  {
    name: 'Velocity Rules Engine',
    description: 'Set limits on payout frequency and amount per connected account or globally across your platform.',
    icon: Gauge,
  },
  {
    name: 'Bank Account Swap Detection',
    description: 'Flags attempts to quickly change bank details before initiating payouts, a common fraud vector.',
    icon: Banknote,
  },
   {
    name: 'IP Geolocation & Risk Scoring',
    description: 'Analyze IP addresses associated with account updates and payouts for location mismatches or known risks.',
    icon: AlertTriangle,
  },
  {
    name: 'Auto-Pause Payouts',
    description: 'Automatically halt payouts for accounts triggering high-risk rules, pending manual review.',
    icon: ShieldCheck,
  },
  {
    name: 'Customizable Heuristics',
    description: 'Fine-tune pre-built rules or create your own based on your platform\'s specific risk profile.',
    icon: SlidersHorizontal,
  },
]

// Pricing tiers data (placeholder)
const tiers = [
  {
    name: 'Starter',
    id: 'tier-starter',
    priceMonthly: '$49',
    description: 'Essential protection for growing platforms.',
    features: ['Real-time Webhook Monitoring', 'Velocity Rules Engine', 'Bank Account Swap Detection', '500 Connected Accounts'],
  },
  {
    name: 'Scale',
    id: 'tier-scale',
    priceMonthly: '$199',
    description: 'Comprehensive defense for large-scale platforms.',
    features: [
      'Everything in Starter',
      'IP Geolocation & Risk Scoring',
      'Auto-Pause Payouts',
      'Customizable Heuristics',
      'Priority Support',
      'Unlimited Connected Accounts',
    ],
  },
]

export default function StripeGuardianPage() {
  const accentColor = 'var(--accent-guardian)';
  const productIdentifier = 'guardian';
  const tableName = 'guardian_leads';

  return (
    <>
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden pt-14">
        <Container className="py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:py-40">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div className="flex items-center gap-2">
              <GuardianIcon />
              <Badge colorVar="var(--accent-guardian)">STRIPE GUARDIAN</Badge>
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Stop fraudulent Stripe payouts before they leave the platform.
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Real-time velocity rules, bank-swap detection & instant auto-pause for Connect.
            </p>
            {/* Waitlist Form prominently displayed in hero */}
            <div className="mt-8">
              <WaitlistForm 
                productIdentifier={productIdentifier} 
                accentColorVar={accentColor} 
                tableName={tableName} 
              />
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Tired of payout fraud hitting your bottom line?</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Guardian acts as your automated fraud team, catching suspicious activity missed by default Stripe rules.
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

      {/* Features Section */}
      <div className="bg-white py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything you need to fight payout fraud</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Guardian provides multiple layers of defense specifically designed for Stripe Connect platforms.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} 
                     className="flex flex-col rounded-2xl border border-t-2 border-[var(--accent-guardian)] bg-white p-8 shadow-[0_0px_0px_0px_var(--tw-shadow-color)] transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_6px_25px_-4px_var(--tw-shadow-color)]" 
                     style={{ '--tw-shadow-color': 'var(--accent-guardian)' } as React.CSSProperties}
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                    <feature.icon className="h-5 w-5 flex-none text-[var(--accent-guardian)]" aria-hidden="true" />
                    {feature.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </div>

      {/* Pricing Section */}
      <div className="bg-gray-50 py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Simple, flat pricing</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Focus on growth, not complex fraud tool billing. Get full access during our early access phase.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {tiers.map((tier) => (
              <Card key={tier.id} className="flex flex-col rounded-2xl border border-t-2 border-[var(--accent-guardian)]">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold leading-8 text-gray-900">{tier.name}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-gray-600">{tier.description}</CardDescription>
                  <div className="mt-4 flex items-baseline gap-x-2">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">{tier.priceMonthly}</span>
                    <span className="text-sm font-semibold leading-6 tracking-wide text-gray-600">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <Check className="h-6 w-5 flex-none text-[var(--accent-guardian)]" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                {/* <CardFooter> Optional Footer </CardFooter> */}
              </Card>
            ))}
          </div>
           <p className="mt-8 text-center text-sm text-gray-500">
            Early-access flat pricing—subject to change after launch.
          </p>
        </Container>
      </div>
    </>
  );
} 