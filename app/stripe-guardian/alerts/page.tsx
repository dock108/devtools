'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Type for connected account data needed
type ConnectedAccount = {
  stripe_account_id: string;
  business_name: string | null;
};

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
  const [initialLoading, setInitialLoading] = useState(true); // Loading accounts
  const [loadingAlerts, setLoadingAlerts] = useState(false); // Loading data for selected account
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [allAccounts, setAllAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [updatingAutoPause, setUpdatingAutoPause] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Show toast on first connect (runs only once)
  useEffect(() => {
    const firstConnect = searchParams.get('first');
    if (firstConnect === '1') {
      toast.success('✅ Account connected — Guardian is now monitoring payouts.');
      // Use window.history.replaceState to remove query param without triggering full effect chain
      window.history.replaceState(null, '', '/stripe-guardian/alerts');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures it runs only on mount

  // Fetch user's connected accounts on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchUserAccounts() {
      console.log('Fetching user accounts...');
      setInitialLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !isMounted) return;
        console.log('Session obtained, fetching accounts for user:', session.user.id);

        // Fetch ALL connected accounts for the user, including business_name
        const { data: accountsData, error: accountsError } = await supabase
          .from('connected_accounts')
          .select('stripe_account_id, business_name') // Select needed fields
          .eq('user_id', session.user.id);

        if (accountsError) throw accountsError;
        console.log('Fetched accounts data:', accountsData);

        if (isMounted) {
          if (accountsData && accountsData.length > 0) {
            setAllAccounts(accountsData);
            // Set the first account as selected initially
            if (!selectedAccountId) {
                console.log('Setting initial selected account:', accountsData[0].stripe_account_id);
                setSelectedAccountId(accountsData[0].stripe_account_id);
            }
          } else {
            console.log('No connected accounts found for user.');
            setAllAccounts([]);
            setSelectedAccountId(null);
          }
        }
      } catch (error) {
        console.error('Error fetching connected accounts:', error);
        toast.error('Failed to load connected accounts');
        if (isMounted) {
          setAllAccounts([]);
          setSelectedAccountId(null);
        }
      } finally {
        if (isMounted) {
          console.log('Finished initial account loading.');
          setInitialLoading(false);
        }
      }
    }

    fetchUserAccounts();
    return () => { 
      console.log('Unmounting account fetch effect');
      isMounted = false; 
    }; // Cleanup
  }, [supabase]); // Only depends on supabase client

  // Fetch alerts and channel settings when selectedAccountId changes
  useEffect(() => {
    if (!selectedAccountId) {
      console.log('No account selected, clearing data.');
      setAlerts([]); // Clear alerts if no account is selected
      setAutoPause(false);
      return; 
    }

    let isMounted = true;
    async function fetchAccountData() {
      console.log(`Fetching data for selected account: ${selectedAccountId}`);
      setLoadingAlerts(true);
      setAlerts([]); // Clear previous account's alerts
      setAutoPause(false); // Reset autopause state

      try {
        // Fetch alert channels for the selected account
        console.log(`Fetching channels for ${selectedAccountId}...`);
        const { data: channels, error: channelError } = await supabase
          .from('alert_channels')
          .select('auto_pause')
          .eq('stripe_account_id', selectedAccountId)
          .maybeSingle();
        
        if (channelError) throw channelError;
        console.log(`Fetched channels for ${selectedAccountId}:`, channels);
        if (isMounted && channels) {
          setAutoPause(channels.auto_pause || false);
        }

        // Fetch alerts for the selected account
        console.log(`Fetching alerts for ${selectedAccountId}...`);
        const { data: alertsData, error: alertsError } = await supabase
          .from('alerts')
          .select('*')
          .eq('stripe_account_id', selectedAccountId)
          .order('created_at', { ascending: false });

        if (alertsError) throw alertsError;
        console.log(`Fetched alerts for ${selectedAccountId}:`, alertsData?.length);
        if (isMounted && alertsData) {
          setAlerts(alertsData);
        }

      } catch (error) {
        console.error('Error fetching data for account:', selectedAccountId, error);
        toast.error(`Failed to load data for account ${selectedAccountId}`);
      } finally {
        if (isMounted) {
          console.log(`Finished fetching data for ${selectedAccountId}`);
          setLoadingAlerts(false);
        }
      }
    }

    fetchAccountData();
    return () => { 
      console.log(`Unmounting data fetch effect for ${selectedAccountId}`);
      isMounted = false; 
    }; // Cleanup
  }, [selectedAccountId, supabase]);

  // Set up real-time subscription based on selectedAccountId
  useEffect(() => {
    if (!selectedAccountId) {
      console.log('No account selected, skipping realtime subscription.');
      return;
    }

    const channelId = `alerts-changes-${selectedAccountId}`;
    console.log(`Setting up realtime channel: ${channelId}`);
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'alerts',
          filter: `stripe_account_id=eq.${selectedAccountId}` // Filter by selected account
        }, 
        (payload) => {
          console.log(`Realtime payload received on ${channelId}:`, payload);
          if (payload.eventType === 'INSERT') {
            setAlerts(prev => [payload.new as Alert, ...prev]);
            toast.success('New alert received!');
          } else if (payload.eventType === 'UPDATE') {
            setAlerts(prev => 
              prev.map(alert => 
                alert.id === payload.new.id ? payload.new as Alert : alert
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAlerts(prev => prev.filter(alert => alert.id !== payload.old.id));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime subscribed on channel: ${channelId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime error on ${channelId}:`, status, err);
          toast.error('Realtime connection error. Refresh might be needed.');
        }
      });

    // Cleanup function to remove the channel when component unmounts or selectedAccountId changes
    return () => {
      console.log(`Removing realtime channel: ${channelId}`);
      supabase.removeChannel(channel).catch(err => console.error('Error removing channel:', err));
    };
  }, [selectedAccountId, supabase]);

  // Toggle auto-pause setting for the selected account
  const toggleAutoPause = async (value: boolean) => {
    if (!selectedAccountId) return;
    
    setUpdatingAutoPause(true);
    try {
      const { error } = await supabase
        .from('alert_channels')
        .update({ auto_pause: value })
        .eq('stripe_account_id', selectedAccountId);

      if (error) throw error;

      setAutoPause(value);
      toast.success(`Auto-pause ${value ? 'enabled' : 'disabled'} for ${selectedAccountId}`);
    } catch (error) {
      console.error('Error updating auto-pause:', error);
      toast.error('Failed to update auto-pause setting');
    } finally {
      setUpdatingAutoPause(false);
    }
  };

  // Mark an alert as resolved (API call likely needs account context if not implicit)
  const markResolved = async (id: number) => {
    // If the API endpoint `/api/alerts/${id}` doesn't implicitly know the account,
    // you might need to pass selectedAccountId in the body or as a query param.
    // For now, assuming the API can handle it based on user session + alert ID.
    try {
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === id ? { ...alert, resolved: true } : alert
        )
      );
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
      if (!response.ok) throw new Error('Failed to update alert');
      toast.success('Alert marked as resolved');
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === id ? { ...alert, resolved: false } : alert
        )
      );
    }
  };

  // Loading state for initial account fetch
  if (initialLoading) {
    return (
      <Container className="py-10">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" /> <span className="ml-2">Loading accounts...</span>
        </div>
      </Container>
    );
  }

  // State when user has no connected accounts at all
  if (allAccounts.length === 0) {
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

  // Filter alerts for the selected account (safe check)
  const filteredAlerts = selectedAccountId ? alerts.filter(alert => alert.stripe_account_id === selectedAccountId) : [];
  const activeAlerts = filteredAlerts.filter(alert => !alert.resolved);
  const resolvedAlerts = filteredAlerts.filter(alert => alert.resolved);

  return (
    <Container className="py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Payout Guardian Alerts</h1>
        
        {/* Account Selector Dropdown - only show if multiple accounts exist */} 
        {allAccounts.length > 1 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-slate-700">Account:</span>
            <Select 
              value={selectedAccountId ?? ''} 
              onValueChange={setSelectedAccountId} 
            >
              <SelectTrigger className="w-auto min-w-[250px]"> {/* Adjust width */} 
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {allAccounts.map(acc => (
                  <SelectItem key={acc.stripe_account_id} value={acc.stripe_account_id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{acc.business_name ?? 'Unnamed Account'}</span>
                      <span className="text-xs text-slate-500 font-mono">{acc.stripe_account_id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Display selected account ID and name if only one account */} 
        {allAccounts.length === 1 && selectedAccountId && (
            <div className="flex items-center space-x-2 p-2 bg-slate-100 rounded-md">
                <span className="text-sm font-medium text-slate-700">Account:</span>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-slate-800">{allAccounts[0].business_name ?? 'Unnamed Account'}</span>
                    <span className="text-xs text-slate-500 font-mono">{selectedAccountId}</span>
                </div>
            </div>
        )}
      </div>

      {/* Auto-pause and Tabs section - only show if an account is selected */} 
      {selectedAccountId && (
        <>
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center space-x-2">
                <span className='text-sm text-slate-600'>Auto-pause alerts for this account</span>
                <Switch
                checked={autoPause}
                onCheckedChange={toggleAutoPause}
                disabled={updatingAutoPause}
                aria-label="Toggle auto-pause for selected account"
                />
            </div>
          </div>

          <Tabs defaultValue="active" className="mt-6">
            <TabsList className="mb-6">
              <TabsTrigger value="active">Active ({activeAlerts.length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({resolvedAlerts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {loadingAlerts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" /> <span className="ml-2">Loading alerts...</span>
                </div>
              ) : (
                <AlertsTable alerts={activeAlerts} onResolve={markResolved} showResolveAction={true} />
              )}
            </TabsContent>
            <TabsContent value="resolved">
              {loadingAlerts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" /> <span className="ml-2">Loading alerts...</span>
                </div>
              ) : (
                <AlertsTable alerts={resolvedAlerts} onResolve={markResolved} showResolveAction={false} />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      {!selectedAccountId && !initialLoading && (
        <div className="text-center text-slate-500 py-10">
            Please select an account to view alerts.
        </div>
      )}
    </Container>
  );
}

// New top-level export that uses Suspense
export default function AlertsPage() {
  return (
    <Suspense fallback={
      <Container className="py-10">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" /> <span className="ml-2">Loading page...</span>
        </div>
      </Container>
    }>
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