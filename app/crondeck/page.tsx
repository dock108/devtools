'use client';

import { Container } from '@/components/ui/container';
// import Image from 'next/image'; // Removed
import { Badge } from '@/components/ui/badge';
// import CrondeckHero from '@/components/products/CrondeckHero'; // Commented out
// import { Features } from '@/components/products/Features'; // Commented out
import { Clock, Check, ListChecks, BellRing, LineChart } from 'lucide-react';
import { WaitlistForm } from '@/components/WaitlistForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Metadata } from 'next';

// Placeholder components - replace or refine
// Removed local Badge component
// Using a generic icon placeholder for now
const ClockIcon = ({ className }: { className?: string }) => (
  <Clock className={cn('w-64 h-64 text-gray-300', className)} />
);

const painPoints = [
  {
    pain: 'A Kubernetes CronJob failed silently overnight, delaying critical batch processing.',
    fix: 'Heartbeat monitoring agent pings CronDeck; get alerted instantly if a ping is missed.',
  },
  {
    pain: 'GitHub Action schedule was skipped due to runner availability or queue backlog.',
    fix: 'GraphQL API poller tracks `last_run` status and detects unexpected delays or skips.',
  },
  {
    pain: 'Multiple cron stacks (K8s, GitHub, Cloud Tasks) means alerts are scattered and noisy.',
    fix: 'Unified dashboard, Slack digests, and PagerDuty integration consolidate all schedules.',
  },
];

const features = [
  {
    name: 'Auto-Discovery',
    description:
      'Connects to Kubernetes, GitHub, GCP Cloud Scheduler, etc. to automatically find and list your cron jobs.',
    icon: ListChecks,
  },
  {
    name: 'Smart Alerts',
    description:
      'Configure heartbeats or status checks. Get notified via Slack, PagerDuty, or webhooks on misfires or delays.',
    icon: BellRing,
  },
  {
    name: 'SLA Monitoring & History',
    description:
      'Track job duration, success rates, and view historical trends to understand schedule performance over time.',
    icon: LineChart,
  },
];

// Pricing tiers data
const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    priceMonthly: '$0',
    description: 'Monitor your essential cron jobs, forever free.',
    features: [
      'Up to 50 Cron Jobs',
      'Kubernetes & GitHub Discovery',
      'Basic Slack Alerts',
      '2 Weeks History',
    ],
  },
  {
    name: 'Join Our Beta',
    id: 'tier-beta',
    priceMonthly: 'Free',
    description: 'Help shape the future of CronDeck with your feedback and suggestions.',
    features: [
      'Early access to premium features',
      'Help prioritize our roadmap',
      'Direct feedback channel to founders',
      'No credit card required',
      'Free during the entire beta period',
    ],
    isBetaCard: true,
  },
];

export default function CrondeckPage() {
  const accentColor = 'var(--accent-crondeck)';
  const productIdentifier = 'crondeck';
  const tableName = 'crondeck_leads';

  return (
    <>
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden pt-14">
        {/* Background Gradient Blob */}
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" // Adjusted gradient colors for violet/pink feel
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <Container className="py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:py-40">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <Badge style={{ backgroundColor: accentColor, color: 'white', borderColor: accentColor }}>CRONDECK</Badge>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Never miss a Cron job again—monitor every schedule in one dashboard.
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Auto-discovers Kubernetes CronJobs, GitHub Action schedules & cloud tasks, then alerts
              on misfires.
            </p>
            {/* Waitlist Form */}
            <div className="mt-8">
              <WaitlistForm
                productIdentifier={productIdentifier}
                accentColorVar={accentColor}
                tableName={tableName}
              />
            </div>
          </div>
          {/* Placeholder Illustration */}
          <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-shrink-0 lg:flex-grow">
            <ClockIcon className="mx-auto w-[24rem] h-[24rem] max-w-full drop-shadow-xl" />
          </div>
        </Container>
      </div>

      {/* Pain/Solution Section */}
      <div className="py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Stop chasing down silent cron failures
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              CronDeck automatically discovers and monitors your scheduled tasks across platforms.
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
                      <dt className="font-semibold text-gray-900">The CronDeck Fix:</dt>
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              One dashboard to rule them all
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              CronDeck brings visibility and reliability to your scattered background tasks.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className={cn(
                    'flex flex-col rounded-2xl border border-t-2 bg-white p-8',
                    'shadow-[0_0px_0px_0px_var(--tw-shadow-color)] transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_6px_25px_-4px_var(--tw-shadow-color)]',
                  )}
                  style={
                    {
                      '--tw-shadow-color': accentColor,
                      borderColor: accentColor,
                    } as React.CSSProperties
                  }
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                    <feature.icon
                      className="h-5 w-5 flex-none text-[var(--accent-crondeck)]"
                      aria-hidden="true"
                    />
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Join our free beta program
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Help us shape CronDeck by providing your feedback on features and pricing that would work for your team.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className="flex flex-col rounded-2xl border border-t-2"
                style={{ borderColor: accentColor }}
              >
                <CardHeader>
                  <CardTitle className="text-lg font-semibold leading-8 text-gray-900">
                    {tier.name}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6 text-gray-600">
                    {tier.description}
                  </CardDescription>
                  <div className="mt-4 flex items-baseline gap-x-2">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      {tier.priceMonthly}
                    </span>
                    <span className="text-sm font-semibold leading-6 tracking-wide text-gray-600">
                      {tier.priceMonthly !== '$0' && tier.priceMonthly !== 'Free' ? '/month' : ''}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  {tier.isBetaCard ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">We'd love your feedback on:</p>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Which features would you pay for?</li>
                        <li>• Would you prefer $19/mo, $49/mo, or $99/mo?</li>
                        <li>• What integrations are essential for you?</li>
                      </ul>
                      <div className="pt-4">
                        <WaitlistForm
                          productIdentifier={productIdentifier}
                          accentColorVar={accentColor}
                          tableName={tableName}
                          placeholderText="Email for beta access + feedback"
                        />
                      </div>
                    </div>
                  ) : (
                    <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex gap-x-3">
                          <Check
                            className="h-6 w-5 flex-none text-[var(--accent-crondeck)]"
                            aria-hidden="true"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Your feedback will help us build the perfect tool for your needs.
          </p>
        </Container>
      </div>
    </>
  );
}
