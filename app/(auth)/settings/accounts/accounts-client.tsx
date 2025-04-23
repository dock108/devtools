'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { RefreshCcw, Trash2, AlertCircle, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RuleSetEditor } from '@/components/accounts/RuleSetEditor';

interface Account {
  id: number;
  stripe_account_id: string;
  business_name: string | null;
  live: boolean;
  webhook_secret: string | null;
  created_at: string;
  rule_set: Record<string, unknown> | null;
  alert_channels: {
    auto_pause: boolean;
  } | null;
}

export default function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase.channel('ca-changes')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'connected_accounts' }, 
          payload => {
            // Update accounts when changes occur
            if (payload.eventType === 'UPDATE' && payload.new) {
              setAccounts(currentAccounts => 
                currentAccounts.map(account => 
                  account.stripe_account_id === (payload.new as Account).stripe_account_id 
                    ? { ...account, ...payload.new as Account } 
                    : account
                )
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setAccounts(currentAccounts => 
                currentAccounts.filter(account => 
                  account.stripe_account_id !== (payload.old as Account).stripe_account_id
                )
              );
            }
          })
      .subscribe();

    // Also subscribe to alert_channels changes
    const alertChannel = supabase.channel('alert-changes')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'alert_channels' }, 
          payload => {
            if (payload.new && payload.new.stripe_account_id) {
              setAccounts(currentAccounts => 
                currentAccounts.map(account => 
                  account.stripe_account_id === payload.new.stripe_account_id
                    ? { 
                        ...account, 
                        alert_channels: { 
                          ...account.alert_channels, 
                          auto_pause: payload.new.auto_pause 
                        } 
                      } 
                    : account
                )
              );
            }
          })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(alertChannel);
    };
  }, [supabase]);

  // Toggle auto-pause setting
  const toggleAutoPause = async (accountId: string, currentValue: boolean) => {
    setLoadingStates(prev => ({ ...prev, [accountId]: true }));
    
    try {
      const { error } = await supabase
        .from('alert_channels')
        .update({ auto_pause: !currentValue })
        .eq('stripe_account_id', accountId);
      
      if (error) throw error;
      
      toast.success(`Auto-pause ${!currentValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-pause:', error);
      toast.error('Failed to update auto-pause setting');
    } finally {
      setLoadingStates(prev => ({ ...prev, [accountId]: false }));
    }
  };

  // Rotate webhook secret
  const rotateWebhookSecret = async (accountId: string) => {
    setLoadingStates(prev => ({ ...prev, [`rotate_${accountId}`]: true }));
    
    try {
      const response = await fetch(`/api/accounts/${accountId}/webhook/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      toast.success('Webhook secret rotated successfully');
    } catch (error) {
      console.error('Error rotating webhook secret:', error);
      toast.error('Failed to rotate webhook secret');
    } finally {
      setLoadingStates(prev => ({ ...prev, [`rotate_${accountId}`]: false }));
    }
  };

  // Disconnect account
  const disconnectAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account? This action cannot be undone.')) {
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, [`disconnect_${accountId}`]: true }));
    
    try {
      const response = await fetch(`/api/accounts/${accountId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Remove from local state (even though realtime will update it)
      setAccounts(accounts.filter(a => a.stripe_account_id !== accountId));
      toast.success('Account disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast.error('Failed to disconnect account');
    } finally {
      setLoadingStates(prev => ({ ...prev, [`disconnect_${accountId}`]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {accounts.map(account => (
        <Card key={account.stripe_account_id} className="overflow-hidden">
          <CardHeader className="bg-slate-50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {account.business_name || account.stripe_account_id}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {account.stripe_account_id} · Connected {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                </CardDescription>
              </div>
              
              <div className="flex items-center">
                <Badge className={account.live ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}>
                  {account.live ? 'Live Mode' : 'Test Mode'}
                </Badge>
                <RuleSetEditor accountId={account.stripe_account_id} ruleSet={account.rule_set} />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <Label htmlFor={`auto-pause-${account.stripe_account_id}`} className="font-medium">
                    Auto-pause payouts
                  </Label>
                </div>
                <Switch
                  id={`auto-pause-${account.stripe_account_id}`}
                  checked={account.alert_channels?.auto_pause || false}
                  disabled={loadingStates[account.stripe_account_id]}
                  onCheckedChange={() => toggleAutoPause(
                    account.stripe_account_id, 
                    account.alert_channels?.auto_pause || false
                  )}
                />
              </div>
              
              <p className="text-sm text-slate-500">
                When enabled, payouts will be automatically paused when high-severity fraud alerts are detected.
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t bg-slate-50 px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => rotateWebhookSecret(account.stripe_account_id)}
              disabled={loadingStates[`rotate_${account.stripe_account_id}`]}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${loadingStates[`rotate_${account.stripe_account_id}`] ? 'animate-spin' : ''}`} />
              {loadingStates[`rotate_${account.stripe_account_id}`] ? 'Rotating...' : 'Rotate Webhook Secret'}
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disconnectAccount(account.stripe_account_id)}
              disabled={loadingStates[`disconnect_${account.stripe_account_id}`]}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {loadingStates[`disconnect_${account.stripe_account_id}`] ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
} 