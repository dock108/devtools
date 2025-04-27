import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase.d';
// import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// import { Button } from '@/components/ui/button';
// import { Plus, Trash2, Edit } from 'lucide-react';
// import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CreateNotificationChannel } from './create-notification-channel';
import { NotificationChannelActions } from './notification-channel-actions';
import DeleteChannelButton from '@/components/admin/DeleteChannelButton';

export const metadata: Metadata = {
  title: 'Notification Channels | Admin Dashboard',
  description: 'Manage notification channels for Stripe Guardian alerts',
};

async function getNotificationChannels() {
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
    .from('notification_channels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notification channels:', error);
    throw new Error('Failed to fetch notification channels');
  }

  return data || [];
}

export default async function NotificationChannelsPage() {
  const channels = await getNotificationChannels();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Notification Channels</h1>
        <CreateNotificationChannel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Notification Channels</CardTitle>
          <CardDescription>Configure where alerts and notifications are sent</CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">No notification channels configured yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first channel to start receiving alerts
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {channel.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {channel.type === 'slack'
                        ? channel.destination.length > 40
                          ? `${channel.destination.substring(0, 40)}...`
                          : channel.destination
                        : channel.destination}
                    </TableCell>
                    <TableCell>
                      <NotificationChannelActions
                        channelId={channel.id}
                        channelName={channel.name}
                      />
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
