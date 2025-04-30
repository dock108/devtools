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
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
      <p className="font-bold">Beta Notice</p>
      <p>
        👷‍♂️ You are currently using the <strong>DOCK108 Beta</strong>.
        Some features may change. Send feedback via the chat widget!
      </p>
    </div>
  );
};

export default BetaBanner;
