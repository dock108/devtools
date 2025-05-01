'use client';

import React, { useState } from 'react';
// import { useSearchParams, useRouter } from 'next/navigation'; // Removed
import useSWR, { mutate } from 'swr'; // For data fetching and optimistic updates
import { linkStripeAccountServerAction } from '../actions'; // Use local actions file
// import { createClient } from '@supabase/supabase-js'; // Removed unused

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Trash2, Copy, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BackfillProgress } from '@/components/progress/BackfillProgress';

// --- Types (assuming structure from GET /api/accounts) ---
type AccountWithStatus = {
  id: string;
  stripe_account_id: string;
  status: string; // 'active' | 'disconnected'
  created_at: string;
  rule_set_id: string | null;
  rule_set_name: string; // 'Default' or actual name
  backfill_status: string; // 'pending' | 'running' | 'completed' | 'failed' | 'unknown'
  backfill_progress: number;
  backfill_error: string | null;
  backfill_updated_at: string | null;
  business_name?: string | null; // Make optional if not always present
};

type RuleSet = {
  id: string;
  name: string;
};

interface ConnectedAccountsManagerProps {
  initialAccounts: AccountWithStatus[];
  userRole: string; // e.g., 'user', 'admin'
  availableRuleSets?: RuleSet[]; // Pass this from server component if admin
}

// --- SWR Fetcher ---
const ACCOUNTS_API_ENDPOINT = '/api/accounts';
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  });

// --- Component Implementation ---
export function ConnectedAccountsManager({
  initialAccounts,
  userRole,
  availableRuleSets = [], // Default to empty if not admin/provided
}: ConnectedAccountsManagerProps) {
  // const router = useRouter(); // Removed

  const { data: accounts = initialAccounts, error: accountsError } = useSWR<AccountWithStatus[]>(
    ACCOUNTS_API_ENDPOINT,
    fetcher,
    {
      fallbackData: initialAccounts,
      refreshInterval: 15000, // Refresh list periodically
    },
  );

  const [isLinking, startLinkTransition] = React.useTransition();
  const [isOperating, startOperatingTransition] = React.useTransition(); // For disconnect/patch
  const [operatingAccountId, setOperatingAccountId] = useState<string | null>(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';
  const canAddAccount = accounts.length < 2;

  // Get search params (e.g., for filtering, though not used currently)
  // const searchParams = useSearchParams(); // Removed

  // --- Handlers ---
  const handleAddAccount = () => {
    if (!canAddAccount) {
      toast.info('Beta Feature Limit', {
        description: 'You can connect a maximum of 2 Stripe accounts during the beta.',
      });
      return;
    }
    startLinkTransition(async () => {
      try {
        const result = await linkStripeAccountServerAction();
        if (result?.url) {
          window.location.href = result.url;
        } else {
          toast.error('Could not start Stripe connection. Please try again.');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred.');
      }
    });
  };

  const handleDisconnect = async (stripeAccountId: string) => {
    setOperatingAccountId(stripeAccountId);
    startOperatingTransition(async () => {
      // Optimistic update
      mutate(
        ACCOUNTS_API_ENDPOINT,
        (currentData) =>
          currentData?.map((acc) =>
            acc.stripe_account_id === stripeAccountId ? { ...acc, status: 'disconnecting' } : acc,
          ),
        false, // Don't revalidate yet
      );

      try {
        const res = await fetch(`/api/accounts/${stripeAccountId}`, { method: 'DELETE' });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to disconnect account');
        }
        toast.success(`Account ${stripeAccountId} disconnected.`);
        // Trigger SWR revalidation
        mutate(ACCOUNTS_API_ENDPOINT);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not disconnect account.');
        // Revert optimistic update on error
        mutate(
          ACCOUNTS_API_ENDPOINT,
          (currentData) =>
            currentData?.map((acc) =>
              acc.stripe_account_id === stripeAccountId ? { ...acc, status: 'active' } : acc,
            ),
          false,
        );
      } finally {
        setOperatingAccountId(null);
        setAccountToDisconnect(null);
      }
    });
  };

  const handleRuleSetChange = async (stripeAccountId: string, newRuleSetId: string | null) => {
    setOperatingAccountId(stripeAccountId);
    const originalRuleSetId = accounts.find(
      (a) => a.stripe_account_id === stripeAccountId,
    )?.rule_set_id;
    const newRuleSetName =
      availableRuleSets.find((rs) => rs.id === newRuleSetId)?.name ?? 'Default';

    startOperatingTransition(async () => {
      // Optimistic update
      mutate(
        ACCOUNTS_API_ENDPOINT,
        (currentData) =>
          currentData?.map((acc) =>
            acc.stripe_account_id === stripeAccountId
              ? { ...acc, rule_set_id: newRuleSetId, rule_set_name: newRuleSetName }
              : acc,
          ),
        false,
      );

      try {
        const res = await fetch(`/api/accounts/${stripeAccountId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rule_set_id: newRuleSetId }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to update rule set');
        }
        toast.success(`Rule set updated for ${stripeAccountId}.`);
        mutate(ACCOUNTS_API_ENDPOINT); // Revalidate
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not update rule set.');
        // Revert optimistic update
        mutate(
          ACCOUNTS_API_ENDPOINT,
          (currentData) =>
            currentData?.map((acc) =>
              acc.stripe_account_id === stripeAccountId
                ? {
                    ...acc,
                    rule_set_id: originalRuleSetId,
                    rule_set_name:
                      accounts.find((a) => a.id === acc.id)?.rule_set_name ?? 'Default',
                  }
                : acc,
            ),
          false,
        );
      } finally {
        setOperatingAccountId(null);
      }
    });
  };

  // --- Render Logic ---
  if (accountsError) {
    return (
      <div className="text-destructive p-4">Error loading accounts. Please try again later.</div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        {/* Title/Desc already in page.tsx */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {' '}
                {/* Span needed for Tooltip when Button is disabled */}
                <Button onClick={handleAddAccount} disabled={isLinking || !canAddAccount}>
                  {isLinking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Stripe Account
                    </>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {!canAddAccount && (
              <TooltipContent>
                <p>Beta Limit: You can connect up to 2 accounts.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No Stripe accounts connected yet.
          </p>
        ) : (
          <>
            {' '}
            {/* TODO: Add Responsive Wrapper for Table/Cards */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule Set</TableHead>
                  <TableHead>Backfill</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const isCurrentOperating =
                    operatingAccountId === account.stripe_account_id && isOperating;
                  const isDisconnected = account.status === 'disconnected';
                  return (
                    <TableRow
                      key={account.stripe_account_id}
                      className={isDisconnected ? 'opacity-50' : ''}
                    >
                      <TableCell className="font-medium">
                        {account.business_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-mono text-xs mr-1">
                            {account.stripe_account_id}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => copyToClipboard(account.stripe_account_id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isDisconnected ? 'outline' : 'success'}>
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select
                            value={account.rule_set_id ?? 'default'}
                            onValueChange={(value) =>
                              handleRuleSetChange(
                                account.stripe_account_id,
                                value === 'default' ? null : value,
                              )
                            }
                            disabled={isCurrentOperating || isDisconnected}
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue placeholder="Select Rule Set" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default" className="text-xs">
                                Default
                              </SelectItem>
                              {availableRuleSets.map((rs) => (
                                <SelectItem key={rs.id} value={rs.id} className="text-xs">
                                  {rs.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{account.rule_set_name}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <BackfillProgress accountId={account.stripe_account_id} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(account.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog
                          open={accountToDisconnect === account.stripe_account_id}
                          onOpenChange={(open) => !open && setAccountToDisconnect(null)}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  {' '}
                                  {/* Required for Tooltip on disabled Button */}
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive h-8 w-8"
                                      onClick={() =>
                                        setAccountToDisconnect(account.stripe_account_id)
                                      }
                                      disabled={isCurrentOperating || isDisconnected}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isDisconnected
                                  ? 'Account already disconnected'
                                  : 'Disconnect Account'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Disconnect {account.stripe_account_id}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will stop all monitoring and alerts for this Stripe account.
                                You can reconnect it later if needed. Are you sure?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setAccountToDisconnect(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDisconnect(account.stripe_account_id)}
                                disabled={isCurrentOperating}
                              >
                                {isCurrentOperating ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {/* Add other actions like Edit/Settings link if needed */}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
