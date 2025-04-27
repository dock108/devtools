import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { Database } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings } from 'lucide-react';
// import AccountStatusToggle from '@/components/admin/AccountStatusToggle'; // Commented out

export const metadata: Metadata = {
  title: 'Connected Accounts | Guardian Admin',
  description: 'Manage connected Stripe accounts and rule set assignments',
};

// Fetch accounts and their assigned rule sets
async function getAccounts() {
  const cookieStore = cookies();

  const supabase = createServerClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
    },
  });

  const { data, error } = await supabase
    .from('accounts')
    .select(
      `
      *,
      rule_sets (
        id,
        name
      )
    `,
    )
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching accounts:', error);
    throw new Error('Failed to fetch accounts');
  }

  return data || [];
}

export default async function AdminAccountsPage() {
  const accounts = await getAccounts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Connected Accounts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Account Settings</CardTitle>
          <CardDescription>Configure rule sets for connected Stripe accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">No accounts connected yet</p>
              <p className="text-sm text-muted-foreground">
                Connect Stripe accounts to start applying rule sets
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule Set</TableHead>
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
                      {account.rule_sets && account.rule_sets.length > 0
                        ? account.rule_sets.map((rs) => rs.name).join(', ')
                        : 'No rule set assigned'}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="icon" asChild>
                        <Link href={`/admin/accounts/${account.id}/settings`}>
                          <Settings className="h-4 w-4" />
                          <span className="sr-only">Settings</span>
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
