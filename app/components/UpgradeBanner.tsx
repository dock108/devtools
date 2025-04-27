import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UpgradeBannerProps {
  monthlyAlertCount: number;
  alertLimit?: number;
}

export function UpgradeBanner({ monthlyAlertCount, alertLimit = 50 }: UpgradeBannerProps) {
  if (monthlyAlertCount <= alertLimit) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4 rounded">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>Free plan alert limit reached.</strong> You&apos;ve used {monthlyAlertCount} of{' '}
            {alertLimit} monthly alerts. Additional alerts may be delayed or dropped.
          </p>
          <div className="mt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/stripe-guardian/settings/billing">Upgrade</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
