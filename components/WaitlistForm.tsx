'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Declare gtag type
declare global {
  interface Window {
    gtag: (event: string, action: string, params?: Record<string, unknown>) => void;
  }
}

// Props for the reusable form
interface WaitlistFormProps {
  tableName: string; // Supabase table name (e.g., 'guardian_leads', 'notary_leads')
  productIdentifier: string; // GA4 product identifier (e.g., 'guardian', 'notary')
  accentColorVar: string; // CSS variable for accent color (e.g., 'var(--accent-guardian)')
  placeholderText?: string; // Optional custom placeholder text
}

export function WaitlistForm({ tableName, productIdentifier, accentColorVar, placeholderText }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    setState('sending');
    setErrorMessage('');

    try {
      // Determine the endpoint based on whether it's for CronDeck
      const endpoint = tableName === 'crondeck_leads' 
        ? '/api/waitlist/subscribe' 
        : '/api/waitlist';
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          tableName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setState('sent');
      toast.success(data.message || "You're on the waitlist!");

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'waitlist_submit', {
          product: productIdentifier,
          status: 'subscribed',
        });
      } else {
        console.warn('gtag function not found for analytics.');
      }
    } catch (error: unknown) {
      console.error('Waitlist submission error:', error);
      setState('error');
      let message = 'An unexpected error occurred. Please try again.';
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setErrorMessage(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-md gap-x-4">
      <Label htmlFor={`${productIdentifier}-email-address`} className="sr-only">
        Email address
      </Label>
      <Input
        id={`${productIdentifier}-email-address`} // Unique ID using product identifier
        name="email"
        type="email"
        autoComplete="email"
        required
        className="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 disabled:opacity-50"
        style={{ '--focus-ring-color': accentColorVar } as React.CSSProperties} // Custom property for focus ring
        placeholder={placeholderText || "Enter your email"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'sending' || state === 'sent'}
        aria-describedby={errorMessage ? `${productIdentifier}-error-message` : undefined}
      />
      <Button
        type="submit"
        disabled={state === 'sending' || state === 'sent'}
        className="flex-none rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        style={
          {
            background: state !== 'sending' && state !== 'sent' ? accentColorVar : undefined,
            borderColor: accentColorVar, // Add border for consistency
            color: 'white',
            '--focus-outline-color': accentColorVar, // Custom property for focus outline
            cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer',
          } as React.CSSProperties
        }
      >
        {state === 'sending' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {state === 'sending' ? 'Joining...' : state === 'sent' ? 'Joined!' : 'Join Waitlist'}
      </Button>
      {errorMessage && (
        <p
          id={`${productIdentifier}-error-message`}
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      {state === 'sent' && (
        <p className="mt-2 text-sm text-green-600">Thanks for joining! We&apos;ll be in touch.</p>
      )}
    </form>
  );
}

// Helper CSS in globals.css might be needed for focus rings/hovers based on CSS vars:
/*
input:focus {
  ring-color: var(--focus-ring-color);
}
button:focus-visible {
  outline-color: var(--focus-outline-color);
}
button:hover:not(:disabled) {
   background-color: color-mix(in srgb, var(backgroundColor) 90%, black);
}
*/
