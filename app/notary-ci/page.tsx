import type { Metadata } from 'next';
import { ExternalLink, Github, CheckCircle2 } from 'lucide-react';
import { Container } from '@/components/Container';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WaitlistForm } from '@/components/WaitlistForm';
import { productLD } from '@/lib/jsonld';
import { Badge } from '@/components/ui/badge';
// import { Features } from '@/components/products/Features'; // Commented out
// import { Hero } from '@/components/products/Hero'; // Commented out

// Placeholder components - replace or refine
const Laptop = ({ className }: { className?: string }) => (
  <svg className={`w-64 h-64 text-gray-300 ${className || ''}`} />
);

// Metadata
export const generateMetadata = (): Metadata => {
  const url = 'https://www.dock108.ai/notary-ci';
  const image = `${url}/opengraph-image`;

  return {
    title: 'Notary CI – Fast macOS notarization | DOCK108',
    description: 'Cloud signing & notarization for indie and studio mac apps.',
    openGraph: {
      title: 'Notary CI – Fast macOS notarization | DOCK108',
      description: 'Cloud signing & notarization for indie and studio mac apps.',
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Notary CI – Fast macOS notarization | DOCK108',
      description: 'Cloud signing & notarization for indie and studio mac apps.',
      images: [image],
    },
    other: {
      'script:type=application/ld+json': JSON.stringify(
        productLD({
          name: 'Notary CI',
          description: 'Cloud signing & notarization for indie and studio mac apps.',
          url,
          image,
          price: '25.00',
        }),
      ),
    },
  };
};

const painPoints = [
  {
    pain: 'The `altool` is deprecated, notarization fails randomly, and App Store Connect is a maze.',
    fix: 'Uses the modern `notarytool` Swift CLI via a stable API, handling auth and retries automatically.',
  },
  {
    pain: 'CI breaks whenever the Apple certificate expires, usually discovered at 2 AM.',
    fix: 'Securely stores your keys/certs in a cloud HSM with auto-renewal alerts and seamless rotation.',
  },
  {
    pain: 'Requires a dedicated macOS runner in CI just for the signing and notarization steps.',
    fix: 'Offload the entire process to our hosted macOS VMs. Trigger via API or GitHub Action.',
  },
];

const features = [
  {
    name: 'Drag-and-Drop Web UI',
    description:
      'No CLI needed. Upload your unsigned .app or .pkg, and download the notarized, stapled output minutes later.',
    icon: ExternalLink,
  },
  {
    name: 'GitHub Action Integration',
    description:
      'Drop our action into your existing workflow. Handles inputs, outputs, and secrets securely.',
    icon: Github,
    code: `uses: dock108/notary-ci-action@v1\\nwith:\\n  api_key: \\\${{ secrets.NOTARY_CI_KEY }}\\n  app_path: ./build/MyApp.dmg`,
  },
  {
    name: 'Audit Log & Stapled Ticket',
    description:
      'Get a full history of submissions and download the stapled notarization ticket for offline validation.',
    icon: CheckCircle2,
  },
];

// Pricing tiers data
const tiers = [
  {
    name: 'Indie',
    id: 'tier-indie',
    priceMonthly: '$25',
    description: 'Perfect for solo devs and small teams notarizing apps.',
    features: ['Unlimited Notarizations', '1 Concurrent Build', 'GitHub Action', 'Web UI Access'],
  },
  {
    name: 'Studio',
    id: 'tier-studio',
    priceMonthly: '$99',
    description: 'Designed for agencies and larger teams needing more capacity.',
    features: [
      'Unlimited Notarizations',
      '5 Concurrent Builds',
      'GitHub Action',
      'Web UI Access',
      'Priority Support',
      'SSO/SAML Integration (Coming Soon)',
    ],
  },
];

export default function NotaryCiPage() {
  const accentColor = 'var(--accent-notary)';
  const productIdentifier = 'notary';
  const tableName = 'notary_leads';

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
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#f472b6] to-[#a855f7] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" // Adjusted gradient colors for fuchsia/purple feel
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>

        <Container className="py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:py-40">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <Badge colorVar={accentColor}>NOTARY CI</Badge>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Codesign & notarize mac builds in 60 seconds—straight from CI.
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Skip the Xcode maze. Upload once or drop our GitHub Action and ship notarized DMGs
              automatically.
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
            <Laptop className="mx-auto w-[24rem] h-[24rem] max-w-full drop-shadow-xl" />
          </div>
        </Container>
      </div>

      {/* Pain/Solution Section */}
      <div className="py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Stop wrestling with macOS signing & notarization
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Notary CI turns a complex, error-prone chore into a simple API call or CI step.
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
                      <dt className="font-semibold text-gray-900">The Notary Fix:</dt>
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
              Everything needed for automated notarization
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Whether you prefer a web UI or full CI/CD integration, Notary CI has you covered.
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
                      className="h-5 w-5 flex-none text-[var(--accent-notary)]"
                      aria-hidden="true"
                    />
                    {feature.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                    <p className="flex-auto">{feature.description}</p>
                    {feature.code && (
                      <pre className="mt-4 overflow-x-auto rounded bg-gray-800 p-4 text-xs text-gray-300">
                        <code>{feature.code}</code>
                      </pre>
                    )}
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
              Flat pricing, no surprises
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Pay per seat or build minute? No thanks. Simple, predictable pricing for everyone.
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
                      /month
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <CheckCircle2
                          className="h-6 w-5 flex-none text-[var(--accent-notary)]"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Early-access pricing—subject to change after launch.
          </p>
        </Container>
      </div>
    </>
  );
}
