'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus } from 'lucide-react';

const channelSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  type: z.enum(['slack', 'email']),
  destination: z.string().min(1, { message: 'Destination is required' }),
});

type FormValues = z.infer<typeof channelSchema>;

export function CreateNotificationChannel() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: '',
      type: 'slack',
      destination: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Check if a channel with this name already exists
      const { data: existing, error: checkError } = await supabase
        .from('notification_channels')
        .select('id')
        .eq('name', values.name)
        .maybeSingle();

      if (checkError) {
        throw new Error(checkError.message);
      }

      if (existing) {
        form.setError('name', {
          message: 'A channel with this name already exists',
        });
        return;
      }

      // Create the new notification channel
      const { error: insertError } = await supabase.from('notification_channels').insert({
        name: values.name,
        type: values.type,
        destination: values.destination,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast({
        title: 'Channel created',
        description: `${values.name} has been created successfully.`,
      });

      // Reset form and close dialog
      form.reset();
      setIsOpen(false);

      // Refresh the page to show the new channel
      router.refresh();
    } catch (error) {
      console.error('Error creating notification channel:', error);
      toast({
        title: 'Error',
        description: `Failed to create channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Notification Channel</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Production Alerts" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch('type') === 'slack' ? 'Webhook URL' : 'Email Address'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        form.watch('type') === 'slack'
                          ? 'https://hooks.slack.com/services/...'
                          : 'alerts@example.com'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
