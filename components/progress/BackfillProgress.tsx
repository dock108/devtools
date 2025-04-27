'use client';

import React from 'react';
import useSWR from 'swr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Assuming shadcn structure
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface BackfillStatus {
  account_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error_message?: string | null;
  updated_at: string;
}

interface BackfillProgressProps {
  accountId: string;
}

// Define fetcher function for SWR
const fetcher = async (url: string): Promise<BackfillStatus | null> => {
  const res = await fetch(url);
  if (!res.ok) {
    // Handle specific errors or return null/throw based on status code
    if (res.status === 404) return null; // Status not found yet is okay
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${res.status}`);
  }
  return res.json();
};

export function BackfillProgress({ accountId }: BackfillProgressProps) {
  const apiUrl = `/api/backfill-status?accountId=${accountId}`;

  // Poll every 5 seconds if status is pending or running
  const { data, error, isLoading } = useSWR<BackfillStatus | null>(apiUrl, fetcher, {
    refreshInterval: (latestData) =>
      latestData?.status === 'pending' || latestData?.status === 'running' ? 5000 : 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              API Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Failed to load status: {error.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!data) {
    // If data is null after loading (e.g., 404), assume pending or just connected
    return <Badge variant="outline">Pending</Badge>;
  }

  switch (data.status) {
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;

    case 'running':
      return (
        <div className="flex items-center gap-2 w-full max-w-[100px]">
          <Progress value={data.progress} className="h-2 flex-grow" />
          <span className="text-xs text-muted-foreground">{data.progress}%</span>
        </div>
      );

    case 'completed':
      return (
        <Badge
          variant="default"
          className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          Complete
        </Badge>
      );

    case 'failed':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Failed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Error: {data.error_message || 'Unknown error'}</p>
              {/* Optionally add a retry button here */}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    default:
      return null; // Should not happen
  }
}
