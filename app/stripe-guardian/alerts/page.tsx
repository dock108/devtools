'use client';

import React, { useEffect, useState, Suspense, useMemo, useTransition } from 'react';
import { format, startOfMonth, formatRelative } from 'date-fns';
import { Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  resumePayoutsServerAction,
  pausePayoutsServerAction,
} from 'app/(auth)/settings/connected-accounts/actions';
import { alertCapFor } from '@/lib/guardian/plan';
import { UpgradeBanner } from '@/app/components/UpgradeBanner';

import { Container } from '@/components/Container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StripeAccountSelect from '@/app/components/StripeAccountSelect';
import MetricCard from '@/app/components/MetricCard';
import { Database } from '@/types/supabase';

// Type for connected account data needed
type ConnectedAccount = {
  stripe_account_id: string;
  business_name: string | null;
  payouts_paused: boolean;
  paused_by: string | null;
  paused_reason: string | null;
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
  risk_score: number | null;
};

// Alert channels type definition
type AlertChannels = {
  id: number;
  stripe_account_id: string;
  slack_webhook_url: string | null;
  email_to: string | null;
  auto_pause: boolean;
};

// Settings type definition - Define locally if import commented out
type Settings = {
  id: string;
  user_id: string;
  tier: string | null;
  free_tier_alert_limit?: number;
  pro_tier_alert_limit?: number;
  enterprise_tier_alert_limit?: number;
  slack_notifications_enabled?: boolean;
  email_notifications_enabled?: boolean;
  // Add other relevant settings fields as needed
};

// StripeEvent might be needed? Define a basic structure or remove usage
type StripeEvent = Record<string, any>; // Placeholder
// Define AlertStatus locally if needed
type AlertStatus = 'open' | 'resolved' | 'muted'; // Example

// Wrap the core logic in a component to use Suspense
function AlertsPageContent() {
  const [initialLoading, setInitialLoading] = useState(true); // Loading accounts
  const [loadingAlerts, setLoadingAlerts] = useState(false); // Loading data for selected account
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [allAccounts, setAllAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [updatingAutoPause, setUpdatingAutoPause] = useState(false);
  // Add new state for settings and monthly alert count
  const [settings, setSettings] = useState<Settings | null>(null);
  const [monthlyAlertCount, setMonthlyAlertCount] = useState(0);
  const [alertMetrics, setAlertMetrics] = useState<{
    monthlyCount: number;
    openCount: number;
    lastProcessed: string | null;
  }>({
    monthlyCount: 0,
    openCount: 0,
    lastProcessed: null,
  });

  // Add state for selected account's payout status
  const [isTogglingPayouts, startToggleTransition] = useTransition();

  const supabase = createClient();
  const searchParams = useSearchParams();

  // Memoize the currently selected account's full data
  const selectedAccountData = useMemo(() => {
    return allAccounts.find((acc) => acc.stripe_account_id === selectedAccountId) || null;
  }, [allAccounts, selectedAccountId]);

  // Function to determine alert cap based on tier
  const alertCapFor = (settings: Settings | null): number => {
    if (!settings) return 50; // Default to free tier limit

    if (settings.tier === 'pro') {
      return settings.pro_tier_alert_limit || 1000; // Default pro tier limit
    } else if (settings.tier === 'enterprise') {
      return settings.enterprise_tier_alert_limit || 10000; // Default enterprise tier limit
    } else {
      // Free tier
      return settings.free_tier_alert_limit || 50; // Default free tier limit
    }
  };

  // Calculate whether to show upgrade banner
  const showUpgradeBanner = useMemo(() => {
    const alertCap = alertCapFor(settings);
    return settings?.tier === 'free' && monthlyAlertCount >= alertCap;
  }, [settings, monthlyAlertCount]);

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
      console.log('Fetching user accounts and payout status...');
      setInitialLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || !isMounted) return;
        console.log('Session obtained, fetching accounts for user:', session.user.id);

        // Fetch ALL connected accounts for the user, including business_name AND payout status
        const { data: accountsData, error: accountsError } = await supabase
          .from('connected_accounts')
          .select('stripe_account_id, business_name, payouts_paused, paused_by, paused_reason') // Select new fields
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

  // Fetch alerts and user settings when selectedAccountId changes
  useEffect(() => {
    if (!selectedAccountId) {
      console.log('No account selected, clearing data.');
      setAlerts([]); // Clear alerts if no account is selected
      setAutoPause(false);
      setMonthlyAlertCount(0); // Reset alert count
      return;
    }

    let isMounted = true;
    async function fetchAccountData() {
      console.log(`Fetching data for selected account: ${selectedAccountId}`);
      setLoadingAlerts(true);
      setAlerts([]); // Clear previous account's alerts
      setAutoPause(false); // Reset autopause state
      setMonthlyAlertCount(0); // Reset alert count

      try {
        // Get current user ID first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error(sessionError?.message || 'User not authenticated');
        }
        const userId = session.user.id;

        // Fetch USER settings, check plan tier
        let { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', userId) // Use user_id
          .maybeSingle();

        // Lazy-create user settings if they don't exist
        if (!settingsData && settingsError && settingsError.code === 'PGRST116') {
          // Row not found
          console.log(`No settings found for user ${userId}, creating defaults.`);
          const { data: newSettings, error: insertError } = await supabase
            .from('settings')
            .insert({
              user_id: userId,
              // Add reasonable defaults for other settings columns here
              slack_notifications_enabled: false,
              email_notifications_enabled: true,
              // ... other defaults
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating default user settings:', insertError);
            // Decide how to handle - maybe proceed without settings or show error
            settingsError = insertError; // Use the insert error
          } else {
            settingsData = newSettings; // Use the newly created settings
            settingsError = null; // Clear the row not found error
          }
        }

        if (settingsError) throw settingsError;

        console.log('Fetched user settings:', settingsData);
        if (isMounted && settingsData) {
          setSettings(settingsData);
        }

        // Get monthly alert count for the current month
        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);

        const { data: monthlyAlerts, error: monthlyAlertsError } = await supabase
          .from('alerts')
          .select('id')
          .eq('stripe_account_id', selectedAccountId)
          .gte('created_at', firstDayOfMonth.toISOString())
          .lte('created_at', now.toISOString());

        if (monthlyAlertsError) {
          console.error('Error fetching monthly alerts:', monthlyAlertsError);
        }

        const monthlyAlertCount = monthlyAlerts?.length || 0;

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
          .select('*, risk_score')
          .eq('stripe_account_id', selectedAccountId)
          .order('created_at', { ascending: false });

        if (alertsError) throw alertsError;
        console.log(`Fetched alerts for ${selectedAccountId}:`, alertsData?.length);
        if (isMounted && alertsData) {
          setAlerts(alertsData);
        }

        // Fetch account info and settings
        async function fetchAccountInfo() {
          if (!selectedAccountId) return;

          try {
            // Fetch settings
            const { data: settingsData, error: settingsError } = await supabase
              .from('settings')
              .select('*')
              .eq('account_id', selectedAccountId)
              .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
              console.error('Error fetching settings:', settingsError);
            }

            setSettings(settingsData || { tier: 'free', free_tier_alert_limit: 50 });

            // Calculate first day of current month
            const firstDayOfMonth = startOfMonth(new Date());

            // Fetch monthly alert count
            const { count: monthlyCount, error: monthlyCountError } = await supabase
              .from('alerts')
              .select('*', { count: 'exact', head: true })
              .eq('account_id', selectedAccountId)
              .gte('created_at', firstDayOfMonth.toISOString());

            if (monthlyCountError) throw monthlyCountError;

            // Fetch open alert count
            const { count: openCount, error: openCountError } = await supabase
              .from('alerts')
              .select('*', { count: 'exact', head: true })
              .eq('account_id', selectedAccountId)
              .eq('status', 'open');

            if (openCountError) throw openCountError;

            // Fetch last processed event timestamp
            const { data: lastEvent, error: lastEventError } = await supabase
              .from('processed_events')
              .select('created_at')
              .eq('account_id', selectedAccountId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (lastEventError && lastEventError.code !== 'PGRST116') {
              console.error('Error fetching last event:', lastEventError);
            }

            setAlertMetrics({
              monthlyCount: monthlyCount || 0,
              openCount: openCount || 0,
              lastProcessed: lastEvent?.created_at || null,
            });

            setMonthlyAlertCount(monthlyCount || 0);
          } catch (error) {
            console.error('Error fetching account info:', error);
          }
        }

        fetchAccountInfo();
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
    }; // Cleanup effect
  }, [supabase, selectedAccountId]); // Added selectedAccountId

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `stripe_account_id=eq.${selectedAccountId}`, // Filter by selected account
        },
        (payload) => {
          console.log(`Realtime payload received on ${channelId}:`, payload);
          if (payload.eventType === 'INSERT') {
            setAlerts((prev) => [payload.new as Alert, ...prev]);
            toast.success('New alert received!');
          } else if (payload.eventType === 'UPDATE') {
            setAlerts((prev) =>
              prev.map((alert) => (alert.id === payload.new.id ? (payload.new as Alert) : alert)),
            );
          } else if (payload.eventType === 'DELETE') {
            setAlerts((prev) => prev.filter((alert) => alert.id !== payload.old.id));
          }
        },
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
      supabase.removeChannel(channel).catch((err) => console.error('Error removing channel:', err));
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

  // --- Add handler for Payouts Toggle ---
  const handleTogglePayouts = () => {
    if (!selectedAccountData) return;

    const account = selectedAccountData;
    startToggleTransition(async () => {
      const action = account.payouts_paused ? resumePayoutsServerAction : pausePayoutsServerAction;
      const optimisticUpdate = !account.payouts_paused;

      // Optimistic UI Update - Modify the allAccounts state directly
      setAllAccounts((prev) =>
        prev.map((acc) =>
          acc.stripe_account_id === account.stripe_account_id
            ? { ...acc, payouts_paused: optimisticUpdate }
            : acc,
        ),
      );

      try {
        await action(account.stripe_account_id);
        toast.success(`Payouts ${optimisticUpdate ? 'paused' : 'resumed'} successfully.`);
        // Re-fetching/revalidation should handle the final state
      } catch (error) {
        // Rollback optimistic update on error
        setAllAccounts((prev) =>
          prev.map((acc) =>
            acc.stripe_account_id === account.stripe_account_id
              ? { ...acc, payouts_paused: account.payouts_paused } // Revert to original state
              : acc,
          ),
        );
        toast.error(error instanceof Error ? error.message : 'Failed to update payout status.');
      }
      // No finally block needed to reset loading state as useTransition handles it
    });
  };

  // Mark an alert as resolved (API call likely needs account context if not implicit)
  const markResolved = async (id: number) => {
    // If the API endpoint `/api/alerts/${id}` doesn't implicitly know the account,
    // you might need to pass selectedAccountId in the body or as a query param.
    // For now, assuming the API can handle it based on user session + alert ID.
    try {
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? { ...alert, resolved: true } : alert)),
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
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? { ...alert, resolved: false } : alert)),
      );
    }
  };

  // --- Helper to get tooltip content ---
  const getPauseTooltipContent = (account: ConnectedAccount | null): string => {
    if (!account) return '';
    if (account.payouts_paused) {
      let reason = `Paused by ${account.paused_by || 'unknown'}`;
      if (account.paused_reason) reason += `: ${account.paused_reason.replace(/_/g, ' ')}`;
      return reason;
    } else {
      return 'Automatic payouts active.';
    }
  };

  // Loading state for initial account fetch
  if (initialLoading) {
    return (
      <Container className="py-10">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />{' '}
          <span className="ml-2">Loading accounts...</span>
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
  const filteredAlerts = selectedAccountId
    ? alerts.filter((alert) => alert.stripe_account_id === selectedAccountId)
    : [];
  const activeAlerts = filteredAlerts.filter((alert) => !alert.resolved);
  const resolvedAlerts = filteredAlerts.filter((alert) => alert.resolved);

  return (
    <Container className="py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Payout Guardian Alerts</h1>

        {/* Account Selector Dropdown - only show if multiple accounts exist */}
        {allAccounts.length > 1 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-slate-700">Account:</span>
            <Select value={selectedAccountId ?? ''} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-auto min-w-[250px]">
                {' '}
                {/* Adjust width */}
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {allAccounts.map((acc) => (
                  <SelectItem key={acc.stripe_account_id} value={acc.stripe_account_id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{acc.business_name ?? 'Unnamed Account'}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {acc.stripe_account_id}
                      </span>
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
              <span className="text-sm font-medium text-slate-800">
                {allAccounts[0].business_name ?? 'Unnamed Account'}
              </span>
              <span className="text-xs text-slate-500 font-mono">{selectedAccountId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Display alert metrics */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <MetricCard
          title="Current Month Alerts"
          value={monthlyAlertCount}
          description={
            settings?.tier === 'free'
              ? `Free tier limit: ${alertCapFor(settings)}`
              : 'Enterprise tier'
          }
        />
        <MetricCard
          title="Open Alerts"
          value={activeAlerts.length}
          description="Unresolved alerts"
        />
        <MetricCard
          title="Last Event Processed"
          value={
            alertMetrics.lastProcessed
              ? formatRelative(new Date(alertMetrics.lastProcessed), new Date())
              : '-'
          }
          description="Last webhook event"
        />
      </div>

      {/* Show upgrade banner for users exceeding free tier limits */}
      {showUpgradeBanner && (
        <UpgradeBanner monthlyAlertCount={monthlyAlertCount} alertLimit={alertCapFor(settings)} />
      )}

      {/* Auto-pause and Tabs section - only show if an account is selected */}
      {selectedAccountId && selectedAccountData && (
        <>
          <TooltipProvider delayDuration={300}>
            {' '}
            {/* Ensure TooltipProvider wraps the toggles */}
            <div className="flex items-center justify-end space-x-6 mb-4">
              {' '}
              {/* Use space-x for spacing */}
              {/* Payout Pause Toggle */}
              <div className="flex items-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium text-slate-600 flex items-center">
                      Pause Payouts
                      <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Stops Stripe from automatically sending funds to your bank. Guardian may turn
                    this off automatically when fraud is suspected. You can resume payouts once
                    you've reviewed the transactions.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Wrap Switch in a div to attach tooltip trigger easily */}
                    <div className="flex items-center">
                      <Switch
                        id={`payout-toggle-${selectedAccountId}`}
                        checked={selectedAccountData.payouts_paused}
                        onCheckedChange={handleTogglePayouts}
                        disabled={isTogglingPayouts}
                        aria-label="Toggle Payouts"
                      />
                      {isTogglingPayouts && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{getPauseTooltipContent(selectedAccountData)}</TooltipContent>
                </Tooltip>
              </div>
              {/* Auto Pause Toggle */}
              <div className="flex items-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium text-slate-600 flex items-center">
                      Auto-Pause Payouts
                      <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Automatically pause payouts on this account when a high-severity alert is
                    triggered. Recommended for enhanced security.
                  </TooltipContent>
                </Tooltip>
                <Switch
                  id={`auto-pause-toggle-${selectedAccountId}`}
                  checked={autoPause}
                  onCheckedChange={toggleAutoPause}
                  disabled={updatingAutoPause}
                  aria-label="Toggle Auto-Pause"
                />
                {updatingAutoPause && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              </div>
            </div>
          </TooltipProvider>

          {/* Alert Tabs */}
          <Tabs defaultValue="active">
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active Alerts ({activeAlerts.length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved Alerts ({resolvedAlerts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {loadingAlerts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                  <span className="ml-2">Loading alerts...</span>
                </div>
              ) : activeAlerts.length > 0 ? (
                <AlertTable alerts={activeAlerts} onMarkResolved={markResolved} />
              ) : (
                <div className="text-center py-10 text-slate-500">
                  No active alerts for this account.
                </div>
              )}
            </TabsContent>
            <TabsContent value="resolved">
              {loadingAlerts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                  <span className="ml-2">Loading alerts...</span>
                </div>
              ) : resolvedAlerts.length > 0 ? (
                <AlertTable alerts={resolvedAlerts} />
              ) : (
                <div className="text-center py-10 text-slate-500">
                  No resolved alerts for this account yet.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      {/* Show loading spinner when switching accounts but not initial load */}
      {!selectedAccountId && !initialLoading && allAccounts.length > 0 && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <span className="ml-2">Selecting account...</span>
        </div>
      )}
    </Container>
  );
}

// Alert table component
function AlertTable({
  alerts,
  onMarkResolved,
}: {
  alerts: Alert[];
  onMarkResolved?: (id: number) => void;
}) {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return (
          <Badge variant="destructive" className="capitalize">
            {severity}
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="warning" className="capitalize">
            {severity}
          </Badge>
        );
      case 'low':
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {severity}
          </Badge>
        );
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Message
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Risk Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Payout ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {format(new Date(alert.created_at), 'MMM d, yyyy, h:mm a')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                {alert.alert_type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">{getSeverityBadge(alert.severity)}</td>
              <td className="px-6 py-4 text-sm text-slate-900 max-w-md truncate">
                {alert.message}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {alert.risk_score ?? 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                {alert.stripe_payout_id ? (
                  <a
                    href={`https://dashboard.stripe.com/payouts/${alert.stripe_payout_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {alert.stripe_payout_id.substring(0, 15)}...
                  </a>
                ) : (
                  'N/A'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {!alert.resolved && onMarkResolved && (
                  <Button variant="outline" size="sm" onClick={() => onMarkResolved(alert.id)}>
                    Mark Resolved
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Need to export the component wrapped in Suspense
export default function AlertsPage() {
  return (
    <Suspense fallback={<AlertsLoadingFallback />}>
      <AlertsPageContent />
    </Suspense>
  );
}

// Fallback component for Suspense
function AlertsLoadingFallback() {
  return (
    <Container className="py-10">
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        <span className="ml-2">Loading page...</span>
      </div>
    </Container>
  );
}
