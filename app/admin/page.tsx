import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import MetricCard from '@/app/components/MetricCard';
import { Database } from '@/types/supabase';

export const metadata: Metadata = {
  title: 'Guardian Admin Dashboard',
  description: 'Manage rule sets and notification settings for Stripe Guardian',
};

export default async function AdminDashboard() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore });

  // Fetch count of connected accounts
  const { data: accountsCount, error: accountsError } = await supabase
    .from('connected_accounts')
    .select('*', { count: 'exact', head: true });

  // Fetch count of rule sets
  const { data: ruleSetsCount, error: ruleSetsError } = await supabase
    .from('rule_sets')
    .select('*', { count: 'exact', head: true });

  // Fetch count of alerts in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: alertsCount, error: alertsError } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Fetch count of backfills in progress
  const { data: backfillsCount, error: backfillsError } = await supabase
    .from('backfill_status')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_progress');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground">Manage rule sets and settings for Stripe Guardian.</p>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Connected Accounts"
          value={accountsError ? 'Error' : (accountsCount?.count ?? 0)}
          description="Total Stripe accounts connected"
        />

        <MetricCard
          title="Rule Sets"
          value={ruleSetsError ? 'Error' : (ruleSetsCount?.count ?? 0)}
          description="Available rule configurations"
        />

        <MetricCard
          title="Alerts (30 days)"
          value={alertsError ? 'Error' : (alertsCount?.count ?? 0)}
          description="Alerts generated in the last month"
        />

        <MetricCard
          title="Active Backfills"
          value={backfillsError ? 'Error' : (backfillsCount?.count ?? 0)}
          description="Currently running backfill jobs"
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/rule-sets/new"
              className="block w-full p-2 text-center bg-primary text-primary-foreground hover:bg-primary/90 rounded"
            >
              Create New Rule Set
            </a>
            <a
              href="/admin/settings"
              className="block w-full p-2 text-center bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded"
            >
              Update Global Settings
            </a>
            <a
              href="/admin/accounts"
              className="block w-full p-2 text-center border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded"
            >
              Manage Connected Accounts
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Documentation:</span> Refer to the{' '}
              <a href="/admin/docs" className="text-blue-500 hover:underline">
                Admin Guide
              </a>{' '}
              for detailed instructions on managing rule sets and notification settings.
            </p>
            <p className="text-sm">
              <span className="font-medium">Supabase:</span> Access the{' '}
              <a
                href="https://app.supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Supabase Dashboard
              </a>{' '}
              for direct database access.
            </p>
            <p className="text-sm">
              <span className="font-medium">Support:</span> Contact the development team on Slack
              for any issues or feedback.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
