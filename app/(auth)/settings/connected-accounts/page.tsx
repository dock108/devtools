import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { ConnectedAccountsManager } from './ConnectedAccountsManager'; // Client component
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import AccountsClient from './accounts-client';

// Revalidate data for this page every 0 seconds (dynamic rendering)
export const revalidate = 0;

export default async function ConnectedAccountsPage() {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login?next=/settings/connected-accounts');
  }

  // Fetch connected accounts for the current user
  const { data: accounts, error } = await supabase
    .from('connected_accounts')
    .select(
      'id, stripe_account_id, business_name, created_at, payouts_paused, paused_by, paused_reason',
    )
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching connected accounts:', error);
    // Display an error message within the layout
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load your connected accounts. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return <ConnectedAccountsManager initialAccounts={accounts || []} />;
}
