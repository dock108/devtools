'use client'; // Needs client-side interaction for button clicks

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use App Router's navigation
import { Container } from '@/components/Container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { Loader2, ExternalLink, CheckCircle } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser'; // Assuming a hook to get user state
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { isPro } from '@/lib/guardian/plan'; // Import the plan helper
import { getSubscription } from '@/lib/supabase/user';
import ManageSubscriptionButton from './ManageSubscriptionButton';

// Define settings type again or import
interface SettingsRow {
  id: string;
  tier?: string | null;
  stripe_customer_id?: string | null;
  // Add other fields if needed to display usage/caps
}

export default function BillingPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isRedirectingCheckout, setIsRedirectingCheckout] = useState(false);
  const [isRedirectingPortal, setIsRedirectingPortal] = useState(false);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    // Display toast messages based on query params from Stripe redirects
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('success')) {
      toast.success('Subscription successful! Welcome to Pro.');
      // Clear query params after showing toast
      router.replace('/billing', { scroll: false });
    }
    if (searchParams.get('cancelled')) {
      toast.error('Checkout cancelled.');
      router.replace('/billing', { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return; // Only fetch if user is loaded

      setIsLoadingSettings(true);
      try {
        // Fetch settings - Adjust query if settings are not global
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'global_settings') // Or .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setSettings(data);
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load billing information.');
      } finally {
        setIsLoadingSettings(false);
      }
    }

    if (!isLoadingUser && user) {
      fetchSettings();
    }
    if (!isLoadingUser && !user) {
      // Handle case where user is definitely not logged in
      setIsLoadingSettings(false);
      // Optionally redirect to login
      // router.push('/login?redirectTo=/billing');
    }
  }, [user, isLoadingUser, supabase, router]);

  const handleUpgrade = async () => {
    setIsRedirectingCheckout(true);
    toast.loading('Redirecting to checkout...');
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to initiate checkout.');
      }
      window.location.href = data.url; // Redirect to Stripe Checkout
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Checkout failed: ${error.message}`);
      setIsRedirectingCheckout(false);
    }
    // No finally block needed as successful redirect leaves the page
  };

  const handleManageSubscription = async () => {
    setIsRedirectingPortal(true);
    toast.loading('Redirecting to billing portal...');
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to open billing portal.');
      }
      window.location.href = data.url; // Redirect to Stripe Billing Portal
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Failed to open portal: ${error.message}`);
      setIsRedirectingPortal(false);
    }
  };

  const isLoading = isLoadingUser || isLoadingSettings;
  const userIsPro = settings ? isPro(settings) : false;

  return (
    <Container className="py-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Billing & Plan</h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : !user ? (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to manage your billing information.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/login?redirectTo=/billing')}>Log In</Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Current Plan</CardTitle>
            <CardDescription>
              You are currently on the{' '}
              <span className={`font-semibold ${userIsPro ? 'text-green-600' : 'text-blue-600'}`}>
                {userIsPro ? 'Pro' : 'Free'}
              </span>{' '}
              plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userIsPro ? (
              <div>
                <p className="text-sm text-slate-600 mb-4">
                  You have full access to all Guardian features. Manage your subscription, view
                  invoices, or update payment methods via the Stripe Billing Portal.
                </p>
                <Button onClick={handleManageSubscription} disabled={isRedirectingPortal}>
                  {isRedirectingPortal ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600 mb-1">The Free plan includes:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 mb-4">
                  <li>Up to 50 alerts per month</li>
                  <li>Core fraud detection rules</li>
                  <li>Email notifications</li>
                </ul>
                <p className="text-sm text-slate-600 mb-4">
                  Upgrade to Pro for unlimited alerts, Slack notifications, advanced rules, and
                  priority support.
                </p>
                <Button
                  onClick={handleUpgrade}
                  disabled={isRedirectingCheckout}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isRedirectingCheckout ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
