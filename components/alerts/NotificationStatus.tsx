'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

interface NotificationStatusProps {
  alertId: string | number; // Changed prop to alertId for fetching
  isAdmin: boolean;
}

// Basic fetcher for SWR
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error('Failed to fetch notification status');
    }
    return res.json();
  });

const NotificationStatus: React.FC<NotificationStatusProps> = ({ alertId, isAdmin }) => {
  const apiUrl = `/api/alerts/${alertId}/notification-status`;
  const { data, error, isLoading } = useSWR<{ deliveryStatus: Record<string, string> | null }>(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30000, // Refresh status periodically (e.g., every 30s)
    },
  );

  const deliveryStatus = data?.deliveryStatus;

  // --- Render Logic ---
  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading notification status...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-500">Error loading status.</div>;
  }
  if (!deliveryStatus || Object.keys(deliveryStatus).length === 0) {
    return <div className="text-sm text-slate-500">No notification status tracked.</div>;
  }

  const getStatusInfo = (status: string | undefined) => {
    switch (status) {
      case 'delivered':
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
          text: 'Delivered',
          color: 'text-green-600',
        };
      case 'failed':
        return {
          icon: <XCircle className="h-4 w-4 text-red-500" />,
          text: 'Failed',
          color: 'text-red-600',
        };
      case 'retrying': // Placeholder status if queue updates it
        return {
          icon: <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />,
          text: 'Retrying',
          color: 'text-yellow-600',
        };
      case 'not_configured':
        return {
          icon: <AlertCircle className="h-4 w-4 text-slate-400" />,
          text: 'Not Configured',
          color: 'text-slate-500',
        };
      default:
        return {
          icon: <AlertTriangle className="h-4 w-4 text-slate-400" />,
          text: 'Unknown',
          color: 'text-slate-500',
        };
    }
  };

  // Handle Retry Click
  const handleRetry = async (channel: string) => {
    const retryUrl = `/api/alerts/${alertId}/retry?channel=${channel}`;
    const toastId = toast.loading(`Requesting retry for ${channel}...`);
    try {
      const res = await fetch(retryUrl, { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to queue retry');
      }
      toast.success(`Retry successfully queued for ${channel}.`, { id: toastId });
      // Trigger revalidation of the status data
      mutate(apiUrl);
    } catch (err: any) {
      console.error('Retry failed:', err);
      toast.error(`Retry failed: ${err.message}`, { id: toastId });
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Notification Status
      </h4>
      <div className="space-y-1">
        {Object.entries(deliveryStatus).map(([channel, status]) => {
          const { icon, text, color } = getStatusInfo(status);
          const channelName = channel.charAt(0).toUpperCase() + channel.slice(1);
          return (
            <div key={channel} className="flex items-center justify-between text-sm">
              <div className={`flex items-center gap-2 font-medium ${color}`}>
                {icon}
                <span>
                  {channelName}: {text}
                </span>
              </div>
              {status === 'failed' && isAdmin && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleRetry(channel)}
                  className="h-auto p-0 text-xs text-indigo-600 hover:text-indigo-500"
                >
                  Retry
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationStatus;
