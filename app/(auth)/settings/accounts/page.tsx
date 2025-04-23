import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/server';
import { Suspense } from 'react';
import { RefreshCcw, Trash2, AlertCircle, LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AccountsClient from './accounts-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountsPage() {
  const supabase = createClient();
  
  // Fetch connected accounts with their alert settings
  const { data: accounts, error } = await supabase
    .from('connected_accounts')
    .select('*, alert_channels(auto_pause)')
    .order('created_at');
  
  if (error) {
    console.error('Error fetching accounts:', error);
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <h3 className="font-medium text-lg mb-2">Error loading accounts</h3>
        <p className="text-slate-500 mb-6">
          There was an error loading your connected accounts. Please try refreshing the page.
        </p>
        <Button onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Connected Accounts</h2>
        <Button asChild>
          <a href="/stripe-guardian/onboard">
            <LinkIcon className="mr-2 h-4 w-4" />
            Connect New Account
          </a>
        </Button>
      </div>
      
      <Suspense fallback={<div>Loading accounts...</div>}>
        {accounts && accounts.length > 0 ? (
          <div className="grid gap-6">
            <AccountsClient initialAccounts={accounts} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="font-medium text-lg mb-2">No accounts connected yet</h3>
            <p className="text-slate-500 mb-6">
              Connect your Stripe account to start monitoring payouts and receive alerts.
            </p>
            <Button asChild>
              <a href="/stripe-guardian/onboard">Connect Stripe Account</a>
            </Button>
          </div>
        )}
      </Suspense>
    </div>
  );
} 