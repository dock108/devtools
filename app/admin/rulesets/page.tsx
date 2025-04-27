import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, EyeIcon } from 'lucide-react';

// Fetch rule sets from the database
async function getRuleSets() {
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
    .from('rule_sets')
    .select(
      `
      *,
      notification_channels (
        id,
        name
      )
    `,
    )
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching rule sets:', error);
    throw new Error('Failed to fetch rule sets');
  }

  return data || [];
}

export default async function AdminRuleSetsPage() {
  const ruleSets = await getRuleSets();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Rule Sets</h1>
        <Button asChild>
          <Link href="/admin/rulesets/create">
            <Plus className="mr-2 h-4 w-4" /> Create Rule Set
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Rule Sets</CardTitle>
          <CardDescription>
            Rule sets define which alerts are triggered for accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ruleSets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">No rule sets configured yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first rule set to define alert triggers
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Notification Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ruleSets.map((ruleSet) => (
                  <TableRow key={ruleSet.id}>
                    <TableCell className="font-medium">{ruleSet.name}</TableCell>
                    <TableCell>{ruleSet.description || '-'}</TableCell>
                    <TableCell>{ruleSet.notification_channels?.[0]?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={ruleSet.is_active ? 'default' : 'secondary'}>
                        {ruleSet.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="icon" asChild>
                          <Link href={`/admin/rulesets/${ruleSet.id}`}>
                            <EyeIcon className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                        <Button variant="outline" size="icon" asChild>
                          <Link href={`/admin/rulesets/${ruleSet.id}/edit`}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                      </div>
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
