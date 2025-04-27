'use client';

import { ChangeEvent } from 'react';
// import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  // Label,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updatePasswordServerAction } from './actions'; // Import the real server action

// Server Action placeholder removed

// Zod schema for validation
const passwordSchema = z
  .object({
    // Note: Supabase handles current password verification internally during updateUser
    // currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters long.')
      .regex(/[0-9]/, 'Password must contain at least one number.')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // Error applies to the confirmation field
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      // currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit: SubmitHandler<PasswordFormValues> = (data) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('newPassword', data.newPassword);

      // Use the imported server action
      const result = await updatePasswordServerAction(formData);

      if (result.success) {
        toast.success('Password updated successfully!');
        form.reset(); // Clear form on success
      } else {
        toast.error(`Error updating password: ${result.error || 'Unknown error'}`);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Current password field removed - Supabase handles this inherently */}
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••••••" {...field} disabled={isPending} />
              </FormControl>
              <FormDescription>
                Must be at least 12 characters, including a number and a symbol.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••••••" {...field} disabled={isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending || !form.formState.isDirty}>
          {isPending ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </Form>
  );
}
