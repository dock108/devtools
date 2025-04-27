'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/components/Container';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { Database } from '@/types/supabase';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

// Types based on API response and table structure
type RuleSet = Database['public']['Tables']['rule_sets']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row']; // Base type

interface AccountWithRuleSetName extends Omit<AccountRow, 'rule_set_id'> {
  rule_set_id: string | null; // Keep this
  rule_set_name: string; // Added by API
}

export default function AccountsAdminPage() {
  const [accounts, setAccounts] = useState<AccountWithRuleSetName[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingRuleSets, setIsLoadingRuleSets] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({}); // Track update state per account ID

  const fetchData = async () => {
    setIsLoadingAccounts(true);
    setIsLoadingRuleSets(true);
    try {
      const [accountsRes, ruleSetsRes] = await Promise.all([
        fetch('/api/admin/accounts'),
        fetch('/api/admin/rule-sets'),
      ]);

      if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
      if (!ruleSetsRes.ok) throw new Error('Failed to fetch rule sets');

      const accountsData = await accountsRes.json();
      const ruleSetsData = await ruleSetsRes.json();

      setAccounts(accountsData || []);
      // Add a placeholder option for assigning "Default" (null rule_set_id)
      setRuleSets([
        { id: '__DEFAULT__', name: 'Default (null)', config: {}, created_at: '' },
        ...(ruleSetsData || []),
      ]);
    } catch (error: any) {
      toast.error(`Error fetching data: ${error.message}`);
    } finally {
      setIsLoadingAccounts(false);
      setIsLoadingRuleSets(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRuleSetChange = async (accountId: string, newRuleSetId: string | null) => {
    setIsUpdating((prev) => ({ ...prev, [accountId]: true }));
    const originalRuleSetId = accounts.find((acc) => acc.id === accountId)?.rule_set_id;

    try {
      // Use __DEFAULT__ sentinel to represent null
      const payloadRuleSetId = newRuleSetId === '__DEFAULT__' ? null : newRuleSetId;

      const res = await fetch(`/api/admin/accounts?id=${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_set_id: payloadRuleSetId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update rule set');
      }

      toast.success(`Rule set for account ${accountId.substring(0, 8)}... updated.`);

      // Update local state optimistically or refetch
      setAccounts((prevAccounts) =>
        prevAccounts.map((acc) =>
          acc.id === accountId
            ? {
                ...acc,
                rule_set_id: payloadRuleSetId,
                rule_set_name: ruleSets.find((rs) => rs.id === newRuleSetId)?.name || 'Default',
              }
            : acc,
        ),
      );
    } catch (error: any) {
      toast.error(`Update failed: ${error.message}`);
      // Revert optimistic update if needed (or rely on refetch)
      // Example revert (simple): refetchData();
    } finally {
      setIsUpdating((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const isLoading = isLoadingAccounts || isLoadingRuleSets;

  return (
    <Container className="py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Manage Connected Accounts</h1>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stripe Account ID</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead className="w-[250px]">Assigned Rule Set</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-4">
                    No connected accounts found.
                  </TableCell>
                </TableRow>
              )}
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-mono text-xs">{acc.stripe_account_id}</TableCell>
                  <TableCell className="font-medium">{acc.account_name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={acc.status === 'active' ? 'success' : 'destructive'}>
                      {acc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {acc.created_at
                      ? formatDistanceToNow(new Date(acc.created_at), { addSuffix: true })
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isUpdating[acc.id] ? (
                      <div className="flex items-center text-sm text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                      </div>
                    ) : (
                      <Select
                        value={acc.rule_set_id === null ? '__DEFAULT__' : acc.rule_set_id}
                        onValueChange={(newRuleSetId) => handleRuleSetChange(acc.id, newRuleSetId)}
                        disabled={isLoadingRuleSets || isUpdating[acc.id]}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Rule Set" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Option for Default (null) */}
                          {/* <SelectItem value="__DEFAULT__">Default (No specific rule set)</SelectItem> */}
                          {ruleSets.map((rs) => (
                            <SelectItem key={rs.id} value={rs.id}>
                              {rs.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Container>
  );
}
