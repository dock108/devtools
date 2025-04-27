'use client';

import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Define the form schema using Zod
const feedbackFormSchema = z.object({
  message: z
    .string()
    .min(10, { message: 'Message must be at least 10 characters.' })
    .max(2000, { message: 'Message must not exceed 2000 characters.' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' })
    .optional()
    .or(z.literal('')),
});

type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

interface FeedbackDialogProps {
  trigger?: React.ReactNode; // Allow custom trigger elements
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      message: '',
      email: '',
    },
  });

  async function onSubmit(values: FeedbackFormData) {
    setIsSubmitting(true);
    const toastId = toast.loading('Submitting feedback...');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit feedback');
      }

      toast.success('Feedback submitted successfully! Thank you.', { id: toastId });
      form.reset(); // Reset form fields
      setIsOpen(false); // Close dialog on success
    } catch (error: any) {
      console.error('Feedback submission error:', error);
      const errorMessage = error.message.includes('Rate limit exceeded')
        ? error.message // Show specific rate limit message
        : 'Failed to submit feedback. Please try again.';
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="link" className="text-sm p-0 h-auto">
            Send Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Send Beta Feedback</DialogTitle>
          <DialogDescription>
            We appreciate you helping us improve Stripe Guardian! What could be better?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Feedback Message</Label>
            <Textarea
              id="message"
              placeholder="Tell us what you think, any issues you encountered, or features you'd like to see..."
              {...form.register('message')}
              rows={5}
              className={form.formState.errors.message ? 'border-red-500' : ''}
            />
            {form.formState.errors.message && (
              <p className="text-xs text-red-600">{form.formState.errors.message.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com (if you'd like a reply)"
              {...form.register('email')}
              className={form.formState.errors.email ? 'border-red-500' : ''}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
