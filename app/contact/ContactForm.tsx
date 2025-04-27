'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface FormData {
  name?: string;
  email: string;
  message: string;
  website?: string; // Honeypot field
}

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.error === 'missing') {
          throw new Error('Please fill in all required fields.');
        } else if (errorData.error === 'invalid_email') {
          throw new Error('Please enter a valid email address.');
        } else if (errorData.error === 'message_too_long') {
          throw new Error('Message is too long. Please limit to 1,000 characters.');
        } else {
          throw new Error('There was a problem submitting your request.');
        }
      }

      // Success
      toast.success("Thanks! We'll be in touch soon.");
      reset(); // Clear the form
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name field (optional) */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name (optional)
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className="w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Email field (required) */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Please enter a valid email address',
            },
          })}
          className={`w-full rounded-md border ${
            errors.email ? 'border-red-500' : 'border-slate-300'
          } p-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary`}
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
      </div>

      {/* Message field (required) */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          rows={5}
          {...register('message', {
            required: 'Message is required',
            maxLength: {
              value: 1000,
              message: 'Message must be less than 1,000 characters',
            },
          })}
          className={`w-full rounded-md border ${
            errors.message ? 'border-red-500' : 'border-slate-300'
          } p-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary`}
        />
        {errors.message && <p className="mt-1 text-sm text-red-500">{errors.message.message}</p>}
        <p className="mt-1 text-xs text-slate-500">Maximum 1,000 characters</p>
      </div>

      {/* Honeypot field - hidden from users, visible to bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} {...register('website')} autoComplete="off" />
      </div>

      {/* Submit button */}
      <div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </Button>
      </div>
    </form>
  );
}
