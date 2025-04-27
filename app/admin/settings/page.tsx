import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { Database } from '@/types/supabase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import NotificationSettingsForm from '@/app/admin/settings/notification-settings-form';

export const metadata: Metadata = {
  title: 'Global Settings | Guardian Admin',
  description: 'Configure global notification settings for the Stripe Guardian application',
};

export default async function AdminSettingsPage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore });

  // Fetch global settings
  const { data: settings, error } = await supabase
    .from('settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch available notification channels
  const { data: notificationChannels, error: channelsError } = await supabase
    .from('notification_channels')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Global Settings</h1>
          <p className="text-muted-foreground">
            Configure global notification settings for all accounts
          </p>
        </div>
        <div>
          <Button asChild variant="outline">
            <Link href="/admin">Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {error && error.code !== 'PGRST116' && (
        <Card className="bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error Loading Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message || 'Unknown error occurred'}</p>
          </CardContent>
        </Card>
      )}

      {channelsError && (
        <Card className="bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error Loading Notification Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{channelsError.message || 'Unknown error occurred'}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Configure default notification channels and settings for all accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm
            initialSettings={settings || {}}
            notificationChannels={notificationChannels || []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>View and manage available notification channels</CardDescription>
        </CardHeader>
        <CardContent>
          {notificationChannels && notificationChannels.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notificationChannels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>{channel.type}</TableCell>
                    <TableCell>{new Date(channel.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/settings/channels/${channel.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No notification channels found</p>
              <Button asChild className="mt-4">
                <Link href="/admin/settings/channels/new">Add Notification Channel</Link>
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button asChild>
            <Link href="/admin/settings/channels/new">Add Channel</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
