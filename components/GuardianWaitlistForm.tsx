'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase'; // Import Supabase client
import { Input } from '@/components/ui/input'; // Assuming shadcn input path
import { Button } from '@/components/ui/button'; // Assuming shadcn button path
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Declare gtag type for GA4 event tracking
declare global {
  interface Window {
    gtag: (event: string, action: string, params?: Record<string, any>) => void;
  }
}

export function GuardianWaitlistForm() {
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
      const { error } = await supabase
        .from('guardian_leads')
        .insert({ email: email })
        .single(); // Use single() if you expect one row or handle potential multiple inserts if needed

      if (error) {
        // Handle specific errors, like unique constraint violation (already subscribed)
        if (error.code === '23505') { // PostgreSQL unique violation code
             setState('sent'); // Treat as success - already on the list
             toast.success("You're already on the waitlist!");
              // Optionally trigger GA event even if already subscribed?
              if (typeof window.gtag === 'function') {
                window.gtag('event', 'waitlist_submit', { product: 'guardian', status: 'already_subscribed' });
              }
        } else {
           throw error; // Re-throw other errors
        }
      } else {
        setState('sent');
        toast.success("You're on the waitlist!");
        // Trigger GA4 event
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'waitlist_submit', { product: 'guardian', status: 'subscribed' });
        } else {
          console.warn('gtag function not found for analytics.');
        }
      }
    } catch (error: any) {
      console.error('Supabase insert error:', error);
      setState('error');
      setErrorMessage(error.message || 'An unexpected error occurred. Please try again.');
      toast.error(errorMessage);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-md gap-x-4">
      <label htmlFor="email-address" className="sr-only">
        Email address
      </label>
      <Input
        id="email-address"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[var(--accent-guardian)] sm:text-sm sm:leading-6 disabled:opacity-50"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'sending' || state === 'sent'}
        aria-describedby={errorMessage ? "error-message" : undefined}
      />
      <Button
        type="submit"
        disabled={state === 'sending' || state === 'sent'}
        className="flex-none rounded-md bg-[var(--accent-guardian)] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color-mix(in_srgb,_var(--accent-guardian)_90%,_black)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-guardian)] disabled:opacity-50"
        style={{ 
            backgroundColor: state !== 'sending' && state !== 'sent' ? 'var(--accent-guardian)' : undefined,
            cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer'
        }}
      >
        {state === 'sending' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {state === 'sending' ? 'Joining...' : state === 'sent' ? 'Joined!' : 'Join Waitlist'}
      </Button>
      {errorMessage && (
        <p id="error-message" className="mt-2 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
      {state === 'sent' && (
         <p className="mt-2 text-sm text-green-600">
           Thanks for joining! We'll be in touch.
         </p>
      )}
    </form>
  );
} 