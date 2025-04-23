import { Container } from '@/components/Container';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DemoViewer } from './DemoViewer';

export const metadata: Metadata = {
  title: 'Guardian Demo',
  description: 'Replay Guardian's fraud scenarios in real time.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Guardian Demo',
    description: 'Replay Guardian's fraud scenarios in real time.',
    images: ['/og-guardian-demo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guardian Demo',
    description: 'Replay Guardian's fraud scenarios in real time.',
    images: ['/og-guardian-demo.png'],
  },
};

// Prevent static generation – demo will fetch live data in future
export const dynamic = 'force-dynamic';

export default function GuardianDemo() {
  return (
    <Container className="py-10 sm:py-16">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Stripe&nbsp;Guardian Live Demo <span className="text-sm font-normal text-gray-500">(Test‑mode)</span>
        </h1>
        <Link
          href="/stripe-guardian"
          className="text-[var(--accent-guardian)] hover:underline hover:opacity-90"
        >
          ← Back to Product
        </Link>
      </div>

      {/* Subtitle */}
      <p className="mt-4 max-w-2xl text-gray-600">
        Watch how Guardian detects a simulated payout‑fraud attack and auto‑pauses it in real time.
      </p>

      {/* Events display */}
      <DemoViewer />
    </Container>
  );
} 