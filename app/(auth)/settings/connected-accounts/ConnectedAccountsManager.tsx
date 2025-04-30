'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  linkStripeAccountServerAction,
  disconnectStripeAccountServerAction,
  resumePayoutsServerAction,
  pausePayoutsServerAction,
  toggleAlertsServerAction,
} from './actions';
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
import { Switch } from '@/components/ui/switch';
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
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, Trash2, Copy, PlusCircle, Info, BellOff, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BackfillProgress } from '@/components/progress/BackfillProgress';
import { Database } from '@/types/supabase';
import { deleteAccount } from '@/lib/api/deleteAccount';

type ConnectedAccount = Database['public']['Tables']['connected_accounts']['Row'];

const MUTE_OPTIONS = [
  { value: '60', label: '1 Hour' },
  { value: '360', label: '6 Hours' },
  { value: '1440', label: '24 Hours' },
  { value: 'infinity', label: 'Indefinitely' },
];

export function ConnectedAccountsManager({
  initialAccounts,
}: {
  initialAccounts: ConnectedAccount[];
}) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(initialAccounts);
  const [isLinking, startLinkTransition] = useTransition();
  const [isDisconnecting, startDisconnectTransition] = useTransition();
  const [isTogglingPayouts, startPayoutsToggleTransition] = useTransition();
  const [togglingPayoutsAccountId, setTogglingPayoutsAccountId] = useState<string | null>(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAccount | null>(null);
  const [muteDuration, setMuteDuration] = useState<string>('360');
  const [isTogglingMute, startMuteToggleTransition] = useTransition();
  const [togglingMuteAccountId, setTogglingMuteAccountId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const searchParams = useSearchParams();

  // Update local state if initialAccounts changes (e.g., after revalidation)
  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  // Check for error flags from OAuth callback
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'duplicate_link') {
      toast.error('This Stripe account is already linked.');
      window.history.replaceState(null, '', '/settings/connected-accounts');
    }
  }, [searchParams]);

  const handleAddAccount = () => {
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

  const handleDisconnect = (stripeAccountId: string) => {
    startDisconnectTransition(async () => {
      const previousAccounts = accounts;
      setAccounts((prev) => prev.filter((acc) => acc.stripe_account_id !== stripeAccountId));
      setAccountToDisconnect(null);
      try {
        await disconnectStripeAccountServerAction(stripeAccountId);
        toast.success('Stripe account disconnected successfully.');
      } catch (error) {
        setAccounts(previousAccounts);
        toast.error(error instanceof Error ? error.message : 'Could not disconnect account.');
      }
    });
  };

  const handleTogglePayouts = (account: ConnectedAccount) => {
    setTogglingPayoutsAccountId(account.stripe_account_id);
    startPayoutsToggleTransition(async () => {
      const action = account.payouts_paused ? resumePayoutsServerAction : pausePayoutsServerAction;
      const optimisticUpdate = !account.payouts_paused;
      const previousAccounts = accounts;

      // Optimistic UI Update
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.stripe_account_id === account.stripe_account_id
            ? { ...acc, payouts_paused: optimisticUpdate }
            : acc,
        ),
      );

      try {
        await action(account.stripe_account_id);
        toast.success(`Payouts ${optimisticUpdate ? 'paused' : 'resumed'} successfully.`);
        // Data will refresh via revalidatePath
      } catch (error) {
        setAccounts(previousAccounts); // Rollback optimistic update
        toast.error(error instanceof Error ? error.message : 'Failed to update payout status.');
      } finally {
        setTogglingPayoutsAccountId(null);
      }
    });
  };

  const handleToggleMute = (account: ConnectedAccount) => {
    setTogglingMuteAccountId(account.stripe_account_id);
    startMuteToggleTransition(async () => {
      const isCurrentlyMuted =
        !!account.alerts_muted_until && new Date(account.alerts_muted_until) > new Date();
      const action = isCurrentlyMuted ? 'unmute' : 'mute';
      let durationMinutes: number | undefined = undefined;

      if (action === 'mute') {
        if (muteDuration === 'infinity') {
          durationMinutes = Infinity;
        } else {
          durationMinutes = parseInt(muteDuration, 10);
          if (isNaN(durationMinutes)) {
            console.warn('Invalid mute duration selected, defaulting to 6 hours');
            durationMinutes = 360; // Default if parse fails
          }
        }
      }

      // Ensure durationMinutes is a number before calculating date
      const optimisticMutedUntil =
        action === 'mute'
          ? durationMinutes === Infinity
            ? 'infinity'
            : typeof durationMinutes === 'number' // Check if it's a valid number
              ? new Date(Date.now() + durationMinutes * 60000).toISOString()
              : null // Handle potential NaN case (though fallback should prevent this)
          : null;

      // Optimistic UI update
      const previousAccounts = accounts;
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.stripe_account_id === account.stripe_account_id
            ? { ...acc, alerts_muted_until: optimisticMutedUntil }
            : acc,
        ),
      );

      try {
        // Construct payload conditionally for exactOptionalPropertyTypes
        const payload: {
          stripeAccountId: string;
          action: 'mute' | 'unmute';
          durationMinutes?: number;
        } = {
          stripeAccountId: account.stripe_account_id,
          action,
        };
        if (action === 'mute' && typeof durationMinutes === 'number') {
          payload.durationMinutes = durationMinutes;
        }

        const result = await toggleAlertsServerAction(payload);

        if (result.success) {
          toast.success(`Alerts ${action === 'mute' ? 'muted' : 'unmuted'} successfully.`);
          // Update with the exact value from the server if different (e.g., due to default fallback)
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.stripe_account_id === account.stripe_account_id
                ? { ...acc, alerts_muted_until: result.mutedUntil }
                : acc,
            ),
          );
        } else {
          throw new Error('Server action failed'); // Should be caught below
        }
        // Data should revalidate via revalidatePath
      } catch (error) {
        setAccounts(previousAccounts); // Rollback
        toast.error(error instanceof Error ? error.message : `Failed to ${action} alerts.`);
      } finally {
        setTogglingMuteAccountId(null);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Stripe ID copied to clipboard!'))
      .catch((_err) => toast.error('Failed to copy ID.'));
  };

  const getPauseTooltipContent = (account: ConnectedAccount): string => {
    if (account.payouts_paused) {
      let reason = `Paused by ${account.paused_by || 'unknown'}`;
      if (account.paused_reason) reason += `: ${account.paused_reason.replace(/_/g, ' ')}`;
      return reason;
    } else {
      return 'Automatic payouts active.';
    }
  };

  const getMuteStatus = (account: ConnectedAccount): { muted: boolean; text: string } => {
    if (account.alerts_muted_until) {
      if (account.alerts_muted_until === 'infinity') {
        return { muted: true, text: 'Muted indefinitely' };
      }
      const muteEndDate = new Date(account.alerts_muted_until);
      if (muteEndDate > new Date()) {
        return {
          muted: true,
          text: `Muted ${formatDistanceToNow(muteEndDate, { addSuffix: true })}`,
        };
      }
    }
    return { muted: false, text: 'Alerts active' };
  };

  const handleDelete = async (accountToDelete: ConnectedAccount) => {
    if (removingId) return; // Prevent double clicks

    // Use confirm dialog as per instructions
    if (
      !confirm(
        `Remove account ${accountToDelete.business_name || accountToDelete.stripe_account_id}? This will delete all associated alerts and cannot be undone.`,
      )
    ) {
      return;
    }

    setRemovingId(accountToDelete.stripe_account_id); // Use stripe_account_id for RPC
    const originalAccounts = [...accounts]; // Store original state for rollback

    // Optimistic update
    setAccounts((currentAccounts) =>
      currentAccounts.filter((acc) => acc.stripe_account_id !== accountToDelete.stripe_account_id),
    );

    const { error } = await deleteAccount(accountToDelete.stripe_account_id);

    if (error) {
      toast.error('Could not delete account. Try again.');
      // Rollback optimistic update
      setAccounts(originalAccounts);
    } else {
      toast.success('Account removed successfully.');
      // No further action needed, optimistic update is now confirmed
    }

    setRemovingId(null); // Reset removing state
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Connected Stripe Accounts</CardTitle>
          <CardDescription>
            Link multiple Stripe accounts to manage them with DOCK108.
          </CardDescription>
        </div>
        <Button onClick={handleAddAccount} disabled={isLinking}>
          {isLinking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Account
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No Stripe accounts connected yet.
          </p>
        ) : (
          <TooltipProvider delayDuration={300}>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Stripe Account ID</TableHead>
                    <TableHead>Payouts</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead>Backfill Status</TableHead>
                    <TableHead>Connected On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const muteStatus = getMuteStatus(account);
                    const isLoadingMute =
                      isTogglingMute && togglingMuteAccountId === account.stripe_account_id;
                    const isLoadingPayouts =
                      isTogglingPayouts && togglingPayoutsAccountId === account.stripe_account_id;
                    return (
                      <TableRow key={account.stripe_account_id}>
                        <TableCell className="font-medium">
                          {account.business_name || 'N/A'}
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <span className="font-mono text-sm">{account.stripe_account_id}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(account.stripe_account_id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <Switch
                                  id={`payout-switch-${account.stripe_account_id}`}
                                  checked={!account.payouts_paused}
                                  onCheckedChange={() => handleTogglePayouts(account)}
                                  disabled={isLoadingPayouts || isDisconnecting}
                                  aria-label={
                                    account.payouts_paused ? 'Resume payouts' : 'Pause payouts'
                                  }
                                />
                                {isLoadingPayouts &&
                                  togglingPayoutsAccountId === account.stripe_account_id && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                  )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{getPauseTooltipContent(account)}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleToggleMute(account)}
                                  disabled={isLoadingMute || isDisconnecting}
                                  aria-label={muteStatus.muted ? 'Unmute alerts' : 'Mute alerts'}
                                >
                                  {isLoadingMute ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <BellOff
                                      className={`h-4 w-4 ${muteStatus.muted ? 'text-destructive' : 'text-muted-foreground'}`}
                                    />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {muteStatus.muted
                                  ? 'Click to unmute alerts'
                                  : 'Click to mute alerts'}
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  Monitoring continues while muted.
                                </span>
                              </TooltipContent>
                            </Tooltip>
                            {muteStatus.muted ? (
                              <Badge variant="secondary" className="whitespace-nowrap">
                                <Clock className="h-3 w-3 mr-1" />
                                {muteStatus.text}
                              </Badge>
                            ) : (
                              <Select
                                value={muteDuration}
                                onValueChange={setMuteDuration}
                                disabled={isLoadingMute}
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MUTE_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      className="text-xs"
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <BackfillProgress accountId={account.stripe_account_id} />
                        </TableCell>
                        <TableCell>{format(new Date(account.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog
                            open={
                              accountToDisconnect?.stripe_account_id === account.stripe_account_id
                            }
                            onOpenChange={(open) => !open && setAccountToDisconnect(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive h-8 w-8"
                                onClick={() => setAccountToDisconnect(account)}
                                disabled={
                                  isDisconnecting &&
                                  accountToDisconnect?.stripe_account_id ===
                                    account.stripe_account_id
                                }
                              >
                                {isDisconnecting &&
                                accountToDisconnect?.stripe_account_id ===
                                  account.stripe_account_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Disconnect {accountToDisconnect?.business_name || 'this account'}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to disconnect this Stripe account? You
                                  won&apos;t be able to monitor its payouts or receive alerts until
                                  reconnected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setAccountToDisconnect(null)}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDisconnect(account.stripe_account_id)}
                                  disabled={isDisconnecting}
                                >
                                  {isDisconnecting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => handleDelete(account)}
                            disabled={removingId === account.stripe_account_id}
                            aria-label="Delete connected account"
                          >
                            {removingId === account.stripe_account_id ? (
                              <span className="text-xs">Removing...</span>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {accounts.map((account) => {
                const muteStatus = getMuteStatus(account);
                const isLoadingMute =
                  isTogglingMute && togglingMuteAccountId === account.stripe_account_id;
                const isLoadingPayouts =
                  isTogglingPayouts && togglingPayoutsAccountId === account.stripe_account_id;
                return (
                  <Card key={account.stripe_account_id} className="border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-lg">{account.business_name || 'N/A'}</CardTitle>
                      <AlertDialog
                        open={accountToDisconnect?.stripe_account_id === account.stripe_account_id}
                        onOpenChange={(open) => !open && setAccountToDisconnect(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => setAccountToDisconnect(account)}
                            disabled={
                              isDisconnecting &&
                              accountToDisconnect?.stripe_account_id === account.stripe_account_id
                            }
                          >
                            {isDisconnecting &&
                            accountToDisconnect?.stripe_account_id === account.stripe_account_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Disconnect {accountToDisconnect?.business_name || 'this account'}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to disconnect this Stripe account? You
                              won&apos;t be able to monitor its payouts or receive alerts until
                              reconnected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setAccountToDisconnect(null)}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDisconnect(account.stripe_account_id)}
                              disabled={isDisconnecting}
                            >
                              {isDisconnecting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-mono">{account.stripe_account_id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(account.stripe_account_id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-muted-foreground">
                        Connected: {format(new Date(account.created_at), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground flex items-center">
                              Payouts
                              <Info className="h-3 w-3 ml-1" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Stops Stripe from automatically sending funds to your bank. Guardian may
                            turn this off automatically when fraud is suspected. You can resume
                            payouts once you&apos;ve reviewed the transactions.
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Switch
                                id={`payout-switch-mobile-${account.stripe_account_id}`}
                                checked={!account.payouts_paused}
                                onCheckedChange={() => handleTogglePayouts(account)}
                                disabled={isLoadingPayouts || isDisconnecting}
                                aria-label={
                                  account.payouts_paused ? 'Resume payouts' : 'Pause payouts'
                                }
                              />
                              {isLoadingPayouts &&
                                togglingPayoutsAccountId === account.stripe_account_id && (
                                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{getPauseTooltipContent(account)}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground flex items-center">
                              Alerts
                              <Info className="h-3 w-3 ml-1" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Stops e-mail/Slack alerts while you investigate. Monitoring continues.
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center space-x-2">
                          {muteStatus.muted ? (
                            <Badge variant="secondary" className="whitespace-nowrap text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {muteStatus.text}
                            </Badge>
                          ) : (
                            <Select
                              value={muteDuration}
                              onValueChange={setMuteDuration}
                              disabled={isLoadingMute}
                            >
                              <SelectTrigger className="h-8 w-[100px] text-xs">
                                <SelectValue placeholder="Duration" />
                              </SelectTrigger>
                              <SelectContent>
                                {MUTE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleToggleMute(account)}
                                disabled={isLoadingMute || isDisconnecting}
                                aria-label={muteStatus.muted ? 'Unmute alerts' : 'Mute alerts'}
                              >
                                {isLoadingMute ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <BellOff
                                    className={`h-4 w-4 ${muteStatus.muted ? 'text-destructive' : 'text-muted-foreground'}`}
                                  />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {muteStatus.muted ? 'Click to unmute alerts' : 'Click to mute alerts'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground flex items-center">
                              Backfill Status
                              <Info className="h-3 w-3 ml-1" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Status of the last backfill operation.
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center space-x-2">
                          <BackfillProgress accountId={account.stripe_account_id} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
