'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { format, register } from 'timeago.js';

// Basic fetcher for SWR
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error('Failed to fetch retention status');
    }
    return res.json();
  });

// Optional: Register a locale if needed for timeago.js
// register('en_US', localeFunc);

const RetentionStatusBadge: React.FC = () => {
  const apiUrl = '/api/admin/retention-status';
  const { data, error, isLoading } = useSWR<{ ranAt: string | null }>(apiUrl, fetcher, {
    refreshInterval: 60000 * 5, // Refresh every 5 minutes
  });

  // State to force re-render for timeago updates
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Update time every minute to keep timeago fresh
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-xs text-slate-500">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Loading status...
      </Badge>
    );
  }

  if (error || !data) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="text-xs">
              <XCircle className="mr-1 h-3 w-3" />
              Status Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Could not load retention status. Check API logs.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!data.ranAt) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs text-slate-500">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Never Run
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>The retention job hasn&apos;t recorded a successful run yet.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const lastRunDate = new Date(data.ranAt);
  const now = new Date(currentTime); // Use state for consistent comparison
  const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
  const timeAgoText = format(lastRunDate);

  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let icon: React.ReactNode = <CheckCircle2 className="mr-1 h-3 w-3" />;
  let text = `Last purge: ${timeAgoText}`;
  let tooltipText = `Retention job ran successfully ${timeAgoText} at ${lastRunDate.toLocaleString()}.`;

  if (hoursSinceLastRun > 48) {
    // Over 48 hours -> Red/Stalled
    variant = 'destructive';
    icon = <XCircle className="mr-1 h-3 w-3" />;
    text = 'Purge Stalled';
    tooltipText = `Retention job may be stalled. Last successful run was ${timeAgoText}. Check cron logs.`;
  } else if (hoursSinceLastRun > 36) {
    // 36-48 hours -> Yellow/Late
    variant = 'secondary'; // Use secondary for yellow-ish
    icon = <AlertTriangle className="mr-1 h-3 w-3" />;
    text = `Purge late: ${timeAgoText}`;
    tooltipText = `Retention job is late. Last successful run was ${timeAgoText}.`;
  } // Default is Green/OK

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="text-xs">
            {icon}
            {text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default RetentionStatusBadge;
