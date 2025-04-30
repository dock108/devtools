'use client';

// import { useEffect } from 'react'; // Removed
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation'; // Import useRouter

import { Profile } from '@/lib/supabase/user'; // Import type
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { updateProfileServerAction } from './actions'; // Import the real server action

// Server Action placeholder removed

// Zod schema for validation
const profileSchema = z.object({
  display_name: z
    .string()
    .max(50, 'Display name must be 50 characters or less.')
    .optional()
    .or(z.literal('')),
  avatar_url: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  // Allow profile to be null
  profile: Profile | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter(); // Get router instance
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    // Use profile data for defaults only if profile exists
    defaultValues: {
      display_name: profile?.display_name ?? '',
      avatar_url: profile?.avatar_url ?? '',
    },
  });

  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    const formData = new FormData();
    formData.append('display_name', data.display_name || '');
    formData.append('avatar_url', data.avatar_url || '');

    // Await the result of the server action
    const result = await updateProfileServerAction(formData);

    if (result.success) {
      toast.success('Profile updated successfully!');
      router.refresh(); // Refresh the current route
    } else {
      toast.error(`Error updating profile: ${result.error || 'Unknown error'}`);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Your display name" {...field} />
              </FormControl>
              <FormDescription>This will be shown publicly on the platform.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormDescription>Enter the URL of your desired avatar image.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}
