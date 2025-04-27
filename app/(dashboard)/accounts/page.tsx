import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { ConnectedAccountsManager } from './ConnectedAccountsManager'; // We'll create this client component
import { Skeleton } from '@/components/ui/skeleton';

// Re-use the query from the API route for consistency
const ACCOUNTS_QUERY = `
  id,
  stripe_account_id,
  status,
  scope,
  created_at,
  rule_set_id,
  rule_sets ( id, name ),
  account_backfill_status ( status, progress, error_message, updated_at )
`;

// Function to fetch data server-side
async function getConnectedAccounts(supabase: ReturnType<typeof createServerClient>) {
  // RLS ensures user only gets their own accounts
  const { data, error } = await supabase
    .from('stripe_accounts')
    .select(ACCOUNTS_QUERY)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching connected accounts server-side:', error);
    // Handle error appropriately, maybe throw or return empty/error state
    return [];
  }

  // Transform data
  const transformedAccounts =
    data?.map((acc) => ({
      id: acc.id,
      stripe_account_id: acc.stripe_account_id,
      status: acc.status,
      created_at: acc.created_at,
      rule_set_id: acc.rule_set_id,
      rule_set_name: acc.rule_sets?.name ?? 'Default',
      backfill_status: acc.account_backfill_status[0]?.status ?? 'unknown',
      backfill_progress: acc.account_backfill_status[0]?.progress ?? 0,
      backfill_error: acc.account_backfill_status[0]?.error_message ?? null,
      backfill_updated_at: acc.account_backfill_status[0]?.updated_at ?? null,
      // Include other needed fields directly (e.g., business_name if added)
      // business_name: acc.business_name,
    })) ?? [];

  return transformedAccounts;
}

// Loading Skeleton Component
function AccountsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-1/4" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// The Page Component (Server Component)
export default async function AccountsPage() {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  // Fetch initial data on the server
  const initialAccounts = await getConnectedAccounts(supabase);

  // We might need user role info for the client component
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userRole = user?.app_metadata?.role ?? 'user'; // Example: Get role from metadata

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Connected Accounts</h1>
      {/* Use Suspense for better loading UX if client component does heavy lifting */}
      {/* <Suspense fallback={<AccountsLoadingSkeleton />}> */}
      <ConnectedAccountsManager initialAccounts={initialAccounts} userRole={userRole} />
      {/* </Suspense> */}
    </div>
  );
}
