'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';

import { Container } from '@/components/Container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Alert type definition
type Alert = {
  id: number;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  stripe_payout_id: string | null;
  stripe_account_id: string;
  resolved: boolean;
  created_at: string;
};

// Alert channels type definition
type AlertChannels = {
  id: number;
  stripe_account_id: string;
  slack_webhook_url: string | null;
  email_to: string | null;
  auto_pause: boolean;
};

// Wrap the core logic in a component to use Suspense
function AlertsPageContent() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [updatingAutoPause, setUpdatingAutoPause] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Show toast on first connect
  useEffect(() => {
    const firstConnect = searchParams.get('first');
    if (firstConnect === '1') {
      toast.success('✅ Account connected — Guardian is now monitoring payouts.');
      // Remove the query param from URL without reloading
      router.replace('/stripe-guardian/alerts', { scroll: false });
    }
  }, [searchParams, router]);

  // Fetch user's account and alerts
  useEffect(() => {
    async function fetchData() {
      try {
        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's connected account (assuming one account per user for now)
        const { data: accounts } = await supabase
          .from('connected_accounts')
          .select('stripe_account_id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (!accounts || accounts.length === 0) {
          setLoading(false);
          return;
        }

        const userAccountId = accounts[0].stripe_account_id;
        setAccountId(userAccountId);

        // Fetch alert channels to get auto_pause setting
        const { data: channels } = await supabase
          .from('alert_channels')
          .select('*')
          .eq('stripe_account_id', userAccountId)
          .maybeSingle();

        if (channels) {
          setAutoPause(channels.auto_pause || false);
        }

        // Fetch alerts for this account
        const { data: alertsData } = await supabase
          .from('alerts')
          .select('*')
          .eq('stripe_account_id', userAccountId)
          .order('created_at', { ascending: false });

        if (alertsData) {
          setAlerts(alertsData);
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
        toast.error('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  // Set up real-time subscription
  useEffect(() => {
    if (!accountId) return;

    // Subscribe to changes on the alerts table
    const channel = supabase
      .channel('alerts-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'alerts',
          filter: `stripe_account_id=eq.${accountId}`
        }, 
        (payload) => {
          console.log('Realtime payload:', payload);
          if (payload.eventType === 'INSERT') {
            setAlerts(prev => [payload.new as Alert, ...prev]);
            toast.success('New alert received!');
          } else if (payload.eventType === 'UPDATE') {
            setAlerts(prev => 
              prev.map(alert => 
                alert.id === payload.new.id 
                  ? payload.new as Alert 
                  : alert
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAlerts(prev => 
              prev.filter(alert => alert.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, supabase]);

  // Toggle auto-pause setting
  const toggleAutoPause = async (value: boolean) => {
    if (!accountId) return;
    
    setUpdatingAutoPause(true);
    try {
      const { error } = await supabase
        .from('alert_channels')
        .update({ auto_pause: value })
        .eq('stripe_account_id', accountId);

      if (error) {
        throw error;
      }

      setAutoPause(value);
      toast.success(`Auto-pause ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-pause:', error);
      toast.error('Failed to update auto-pause setting');
    } finally {
      setUpdatingAutoPause(false);
    }
  };

  // Mark an alert as resolved
  const markResolved = async (id: number) => {
    try {
      // Optimistic update
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === id 
            ? { ...alert, resolved: true } 
            : alert
        )
      );

      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alert');
      }

      toast.success('Alert marked as resolved');
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
      
      // Revert optimistic update on error
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === id 
            ? { ...alert, resolved: false }
            : alert
        )
      );
    }
  };

  if (loading) {
    return (
      <Container className="py-10">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </Container>
    );
  }

  if (!accountId) {
    return (
      <Container className="py-10">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="font-medium text-lg mb-2">No account connected</h3>
          <p className="text-slate-500 mb-6">
            Connect your Stripe account to start monitoring payouts and receive alerts.
          </p>
          <Button asChild>
            <a href="/stripe-guardian/onboard">Connect Stripe Account</a>
          </Button>
        </div>
      </Container>
    );
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);

  return (
    <Container className="py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Payout Guardian Alerts</h1>
        <div className="flex items-center space-x-2">
          <span className='text-sm text-slate-600'>Auto-pause alerts</span>
          <Switch
            checked={autoPause}
            onCheckedChange={toggleAutoPause}
            disabled={updatingAutoPause}
            aria-label="Toggle auto-pause for alerts"
          />
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="mb-6">
          <TabsTrigger value="active">Active ({activeAlerts.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedAlerts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <AlertsTable alerts={activeAlerts} onResolve={markResolved} showResolveAction={true} />
        </TabsContent>
        <TabsContent value="resolved">
          <AlertsTable alerts={resolvedAlerts} onResolve={markResolved} showResolveAction={false} />
        </TabsContent>
      </Tabs>
    </Container>
  );
}

// New top-level export that uses Suspense
export default function AlertsPage() {
  return (
    <Suspense fallback={<div>Loading page...</div>}> 
      <AlertsPageContent />
    </Suspense>
  );
}

type AlertsTableProps = {
  alerts: Alert[];
  onResolve: (id: number) => void;
  showResolveAction: boolean;
};

function AlertsTable({ alerts, onResolve, showResolveAction }: AlertsTableProps) {
  if (alerts.length === 0) {
    return <div className="text-center text-slate-500 py-10">No alerts here.</div>;
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Severity</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Message</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payout ID</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
            {showResolveAction && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Resolve</span></th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge variant={getSeverityBadge(alert.severity)} className="capitalize">{alert.severity}</Badge>
              </td>
              <td className="px-6 py-4 text-sm text-slate-700">{alert.message}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{alert.stripe_payout_id || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500" title={new Date(alert.created_at).toISOString()}>
                {format(new Date(alert.created_at), 'PP pp')}
              </td>
              {showResolveAction && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button variant="outline" size="sm" onClick={() => onResolve(alert.id)}>
                    Mark Resolved
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 