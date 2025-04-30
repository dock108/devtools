import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { Database } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Rule Sets | Guardian Admin',
  description: 'Create and manage rule sets for Stripe Guardian accounts',
};

export default async function AdminRuleSetsPage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore });

  // Fetch rule sets with account count
  const { data: ruleSets, error } = await supabase.rpc('get_rule_sets_with_account_count');

  // If the RPC doesn't exist, provide SQL to create it
  const rpcNotFoundError = error?.message?.includes(
    'function get_rule_sets_with_account_count() does not exist',
  );
  const createRpcSQL = `
-- Create the RPC function to get rule sets with account counts
CREATE OR REPLACE FUNCTION get_rule_sets_with_account_count()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  account_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rs.id, 
    rs.name, 
    rs.description, 
    rs.created_at,
    rs.updated_at,
    rs.created_by,
    COUNT(ca.id) as account_count
  FROM 
    public.rule_sets rs
  LEFT JOIN 
    public.connected_accounts ca ON rs.id = ca.rule_set_id
  GROUP BY 
    rs.id
  ORDER BY 
    rs.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rule Sets</h1>
          <p className="text-muted-foreground">
            Create and manage rule sets for connected accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/rule-sets/new">
              <Plus className="mr-2 h-4 w-4" /> Create Rule Set
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {rpcNotFoundError && (
        <Card className="bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              RPC Function Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              The function <code>get_rule_sets_with_account_count</code> does not exist in your
              Supabase instance.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please create it using the SQL below:
            </p>
            <pre className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-md overflow-auto text-xs">
              {createRpcSQL}
            </pre>
          </CardContent>
        </Card>
      )}

      {error && !rpcNotFoundError && (
        <Card className="bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error Loading Rule Sets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message || 'Unknown error occurred'}</p>
          </CardContent>
        </Card>
      )}

      {ruleSets && ruleSets.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Rule Sets</CardTitle>
            <CardDescription>There are no rule sets defined yet</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Rule sets define which alerts are triggered for connected accounts.</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/admin/rule-sets/new">
                  <Plus className="mr-2 h-4 w-4" /> Create Your First Rule Set
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {ruleSets && ruleSets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rule Sets ({ruleSets.length})</CardTitle>
            <CardDescription>Manage rule sets and view account assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ruleSets.map((ruleSet) => (
                  <TableRow key={ruleSet.id}>
                    <TableCell className="font-medium">{ruleSet.name}</TableCell>
                    <TableCell>
                      <div className="max-w-md truncate">
                        {ruleSet.description || 'No description'}
                      </div>
                    </TableCell>
                    <TableCell>{ruleSet.account_count}</TableCell>
                    <TableCell>{new Date(ruleSet.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/rule-sets/${ruleSet.id}/edit`}>Edit</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/rule-sets/${ruleSet.id}/view`}>View Details</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
