'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Loader2 } from 'lucide-react';

export default function RuleSetDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isLoading, setIsLoading] = useState(true);
  const [ruleSet, setRuleSet] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch rule set details
        const { data: ruleSetData, error: ruleSetError } = await supabase
          .from('rule_sets')
          .select(`
            *,
            notification_channels (
              id,
              name,
              type
            )
          `)
          .eq('id', params.id)
          .single();

        if (ruleSetError) {
          throw new Error(`Error fetching rule set: ${ruleSetError.message}`);
        }

        if (!ruleSetData) {
          throw new Error('Rule set not found');
        }

        setRuleSet(ruleSetData);

        // Fetch accounts using this rule set
        const { data: accountsData, error: accountsError } = await supabase
          .from('accounts')
          .select('*')
          .eq('rule_set_id', params.id)
          .order('display_name', { ascending: true });

        if (accountsError) {
          throw new Error(`Error fetching accounts: ${accountsError.message}`);
        }

        setAccounts(accountsData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id, supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/rulesets">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button
              className="mt-4"
              onClick={() => router.push('/admin/rulesets')}
            >
              Return to Rule Sets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/rulesets">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{ruleSet.name}</h1>
        </div>
        <Button asChild>
          <Link href={`/admin/rulesets/${params.id}/edit`}>
            <Edit className="h-4 w-4 mr-2" /> Edit Rule Set
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rule Set Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                <p className="mt-1">{ruleSet.description || 'No description provided'}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Status</h3>
                <Badge 
                  className="mt-1"
                  variant={ruleSet.is_active ? "default" : "secondary"}
                >
                  {ruleSet.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Notification Channel</h3>
                <p className="mt-1">
                  {ruleSet.notification_channels && ruleSet.notification_channels.length > 0
                    ? ruleSet.notification_channels.map((channel: any) => (
                        <Badge key={channel.id} variant="outline" className="mr-2">
                          {channel.name} ({channel.type})
                        </Badge>
                      ))
                    : 'No notification channel assigned'}
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Created</h3>
                <p className="mt-1">{new Date(ruleSet.created_at).toLocaleString()}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Last Modified</h3>
                <p className="mt-1">{new Date(ruleSet.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs font-mono h-[300px]">
              {JSON.stringify(ruleSet.rules_config, null, 2) || '{}'}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts Using This Rule Set</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">No accounts are currently using this rule set.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.display_name || 'Unnamed Account'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{account.stripe_id}</TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'default' : 'secondary'}>
                        {account.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/accounts/${account.id}/settings`}>
                          View Settings
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 