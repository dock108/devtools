'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  rules_config: z.string().optional(),
  notification_channel_id: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
}

export default function EditRuleSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
      rules_config: '',
      notification_channel_id: null,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch rule set details
        const { data: ruleSet, error: ruleSetError } = await supabase
          .from('rule_sets')
          .select('*')
          .eq('id', params.id)
          .single();

        if (ruleSetError) {
          throw new Error(`Error fetching rule set: ${ruleSetError.message}`);
        }

        if (!ruleSet) {
          throw new Error('Rule set not found');
        }

        // Fetch notification channels
        const { data: channels, error: channelsError } = await supabase
          .from('notification_channels')
          .select('id, name, type')
          .order('name', { ascending: true });

        if (channelsError) {
          throw new Error(`Error fetching notification channels: ${channelsError.message}`);
        }

        setNotificationChannels(channels || []);

        // Fetch the current notification channel for this rule set
        const { data: currentChannel, error: currentChannelError } = await supabase
          .from('rule_set_notification_channels')
          .select('notification_channel_id')
          .eq('rule_set_id', params.id)
          .maybeSingle();

        if (currentChannelError) {
          console.error('Error fetching current channel:', currentChannelError);
          // Handle error appropriately, maybe show a toast or set an error state
          // For now, log it and potentially proceed without pre-selecting
        }

        // Set form values
        form.reset({
          name: ruleSet.name,
          description: ruleSet.description || '',
          is_active: ruleSet.is_active,
          rules_config: JSON.stringify(ruleSet.rules_config || {}, null, 2),
          notification_channel_id: currentChannel?.notification_channel_id || null,
        });
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id, supabase, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse the rules_config to ensure it's valid JSON
      let rulesConfig = {};
      if (values.rules_config) {
        try {
          rulesConfig = JSON.parse(values.rules_config);
        } catch (err) {
          form.setError('rules_config', {
            message: 'Invalid JSON format',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Update the rule set
      const { error: updateError } = await supabase
        .from('rule_sets')
        .update({
          name: values.name,
          description: values.description || null,
          is_active: values.is_active,
          rules_config: rulesConfig,
        })
        .eq('id', params.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update notification channel association (first delete existing, then add new if selected)
      await supabase.from('rule_set_notification_channels').delete().eq('rule_set_id', params.id);

      if (values.notification_channel_id) {
        const { error: channelError } = await supabase
          .from('rule_set_notification_channels')
          .insert({
            rule_set_id: params.id,
            notification_channel_id: values.notification_channel_id,
          });

        if (channelError) {
          throw new Error(channelError.message);
        }
      }

      toast({
        title: 'Rule set updated',
        description: `${values.name} has been updated successfully.`,
      });

      // Redirect to the rule set details page
      router.push(`/admin/rulesets/${params.id}`);
    } catch (_error) {
      console.error('Error updating rule set:', _error);
      toast({
        title: 'Error',
        description: `Failed to update rule set: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Link href={`/admin/rulesets/${params.id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => router.push(`/admin/rulesets/${params.id}`)}>
              Return to Rule Set Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/admin/rulesets/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Rule Set</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Rule Set</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>A unique name for this rule set</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-24" {...field} />
                    </FormControl>
                    <FormDescription>
                      Provide details about when this rule set should be used
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable this rule set for immediate use with accounts
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notification_channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Channel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a notification channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {notificationChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name} ({channel.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a channel to receive notifications for alerts triggered by this rule
                      set
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rules_config"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rules Configuration (JSON)</FormLabel>
                    <FormControl>
                      <Textarea className="font-mono min-h-48" {...field} />
                    </FormControl>
                    <FormDescription>
                      Specify rule configurations in valid JSON format
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/admin/rulesets/${params.id}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
