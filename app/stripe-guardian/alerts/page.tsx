'use client';

import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [updatingAutoPause, setUpdatingAutoPause] = useState(false);
  const supabase = createClientComponentClient();

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

  // Filter alerts by resolved status
  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);

  if (loading) {
    return (
      <Container>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Stripe Guardian Alerts</h1>
          
          <div className="flex items-center gap-2">
            <span className="text-sm">Auto-pause payouts on critical alerts</span>
            <Switch 
              checked={autoPause} 
              onCheckedChange={toggleAutoPause}
              disabled={updatingAutoPause}
            />
          </div>
        </div>

        <Tabs defaultValue="unresolved">
          <TabsList className="mb-4">
            <TabsTrigger value="unresolved">
              Unresolved {unresolvedAlerts.length > 0 && `(${unresolvedAlerts.length})`}
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved {resolvedAlerts.length > 0 && `(${resolvedAlerts.length})`}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="unresolved">
            {unresolvedAlerts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border">
                <p className="text-lg">🎉 No open alerts – Guardian is happy.</p>
              </div>
            ) : (
              <AlertsTable 
                alerts={unresolvedAlerts} 
                onResolve={markResolved}
                showResolveAction
              />
            )}
          </TabsContent>
          
          <TabsContent value="resolved">
            {resolvedAlerts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border">
                <p className="text-lg">No resolved alerts yet.</p>
              </div>
            ) : (
              <AlertsTable 
                alerts={resolvedAlerts} 
                onResolve={markResolved}
                showResolveAction={false}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}

type AlertsTableProps = {
  alerts: Alert[];
  onResolve: (id: number) => void;
  showResolveAction: boolean;
};

function AlertsTable({ alerts, onResolve, showResolveAction }: AlertsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border rounded-md text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-left font-medium">Rule</th>
            <th className="px-4 py-2 text-left font-medium">Severity</th>
            <th className="px-4 py-2 text-left font-medium">Message</th>
            <th className="px-4 py-2 text-left font-medium">Payout ID</th>
            {showResolveAction && (
              <th className="px-4 py-2 text-left font-medium">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, index) => (
            <tr 
              key={alert.id} 
              className={index % 2 === 0 ? '' : 'bg-slate-50'}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                {format(new Date(alert.created_at), 'MMM d, yyyy HH:mm:ss')}
              </td>
              <td className="px-4 py-3">{alert.alert_type}</td>
              <td className="px-4 py-3">
                <Badge variant={alert.severity as any}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </td>
              <td className="px-4 py-3">{alert.message}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {alert.stripe_payout_id || 'N/A'}
              </td>
              {showResolveAction && (
                <td className="px-4 py-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onResolve(alert.id)}
                  >
                    Resolve
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