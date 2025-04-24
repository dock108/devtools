'use client';

import Link from 'next/link';
import { useSession } from '@/hooks/useSession';

export function StripeGuardianCTAs() {
  const { session, loading } = useSession();

  // Don't render anything until session loading is complete
  if (loading) {
    return (
      <div className="mt-6 flex flex-wrap gap-4">
        {/* Demo link always visible */}
        <Link
          href="/guardian-demo"
          className="inline-flex items-center rounded-lg bg-[var(--accent-guardian)] px-6 py-3 font-semibold text-white shadow-lg hover:opacity-90"
        >
          View Live Demo &rarr;
        </Link>
        {/* Placeholder for connect button */}
        <div className="h-[46px] w-[250px] animate-pulse rounded-lg bg-gray-200"></div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-4">
      <Link
        href="/guardian-demo"
        className="inline-flex items-center rounded-lg bg-[var(--accent-guardian)] px-6 py-3 font-semibold text-white shadow-lg hover:opacity-90"
      >
        View Live Demo &rarr;
      </Link>
      {/* Conditionally render Connect button */}
      {session && (
        <Link
          href="/stripe-guardian/onboard"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
        >
          Connect Your Stripe Account
        </Link>
      )}
    </div>
  );
} 