'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { updateAdminSettingsServerAction } from './actions';

// Define form schema
const formSchema = z.object({
  default_notification_channels: z.array(z.string()).optional(),
  alert_threshold: z.coerce.number().min(0).max(100).optional(),
  email_recipients: z.string().optional(),
  slack_webhook_url: z.string().url().optional().or(z.literal('')),
  teams_webhook_url: z.string().url().optional().or(z.literal('')),
  send_daily_summary: z.boolean().default(false),
  summary_time: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type NotificationChannel = {
  id: string;
  name: string;
  type: string;
  created_at: string;
};

interface NotificationSettingsFormProps {
  initialSettings: any;
  // notificationChannels: NotificationChannel[]; // Commented out unused prop
}

export default function NotificationSettingsForm({
  initialSettings,
  // notificationChannels, // Commented out unused prop
}: NotificationSettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isPending, startTransition] = useTransition();

  // Convert email_recipients array to string for form
  const emailRecipientsStr = initialSettings.email_recipients
    ? Array.isArray(initialSettings.email_recipients)
      ? initialSettings.email_recipients.join(', ')
      : initialSettings.email_recipients
    : '';

  // Initialize form with existing settings
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      default_notification_channels: initialSettings.default_notification_channels || [],
      alert_threshold: initialSettings.alert_threshold || 3,
      email_recipients: emailRecipientsStr,
      slack_webhook_url: initialSettings.slack_webhook_url || '',
      teams_webhook_url: initialSettings.teams_webhook_url || '',
      send_daily_summary: initialSettings.send_daily_summary || false,
      summary_time: initialSettings.summary_time || '08:00',
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Process email recipients
      const emailRecipients = values.email_recipients
        ? values.email_recipients.split(',').map((email) => email.trim())
        : null;

      const settingsData = {
        ...values,
        email_recipients: emailRecipients,
        updated_at: new Date().toISOString(),
      };

      // Always UPSERT the global settings row
      const { error: upsertError } = await supabase
        .from('settings')
        .upsert({ ...settingsData, id: 'global_settings' })
        .eq('id', 'global_settings'); // Match on ID for upsert

      if (upsertError) throw upsertError;

      toast.success('Global settings updated successfully');
      router.refresh();
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
      toast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Alert Notification Settings</h3>
            <Separator />

            <FormField
              control={form.control}
              name="alert_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Threshold</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} {...field} />
                  </FormControl>
                  <FormDescription>
                    Number of alerts required before sending notifications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="slack_webhook_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slack Webhook URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://hooks.slack.com/..." {...field} />
                    </FormControl>
                    <FormDescription>Webhook URL for Slack notifications</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teams_webhook_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Microsoft Teams Webhook URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://outlook.office.com/webhook/..." {...field} />
                    </FormControl>
                    <FormDescription>Webhook URL for Microsoft Teams notifications</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email_recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Recipients</FormLabel>
                  <FormControl>
                    <Textarea placeholder="email1@example.com, email2@example.com" {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated list of email addresses</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Daily Summary Settings</h3>
            <Separator />

            <FormField
              control={form.control}
              name="send_daily_summary"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Send Daily Summary</FormLabel>
                    <FormDescription>
                      Send a daily summary of alerts to all notification channels
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {form.watch('send_daily_summary') && (
              <FormField
                control={form.control}
                name="summary_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary Time (UTC)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>
                      Time of day to send the summary (in UTC timezone)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
