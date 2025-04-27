'use client'; // Needs client-side logic for dialog trigger

import React from 'react';
import Link from 'next/link';
import { AlertCircle, MessageSquareQuote, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';

const BetaBanner: React.FC = () => {
  // Check if the app is in beta stage
  const isBeta = process.env.NEXT_PUBLIC_RELEASE_STAGE === 'beta';

  if (!isBeta) {
    return null; // Don't render if not in beta
  }

  return (
    <Alert className="rounded-none border-l-0 border-r-0 border-t-0 border-b border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
      <Info className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
      {/* <AlertTitle>Beta Notice</AlertTitle> */}
      <AlertDescription className="text-xs flex items-center justify-center gap-4">
        <span>
          👷‍♂️ You are currently using the <strong>Stripe Guardian Beta</strong>.
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/docs/faq" // TODO: Update if final FAQ path differs
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-2"
          >
            View FAQ
          </Link>
          <FeedbackDialog
            trigger={<button className="hover:underline underline-offset-2">Send Feedback</button>}
          />
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default BetaBanner;
