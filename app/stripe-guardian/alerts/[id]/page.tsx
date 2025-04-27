import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Database } from '@/types/supabase';
import { Container } from '@/components/Container';
import { AlertFeedback } from './AlertFeedback'; // Client component for feedback

// Fetch data server-side
async function getAlertDetails(
  supabase: any,
  alertId: string,
  userId: string,
): Promise<Database['public']['Tables']['alerts']['Row'] | null> {
  // TODO: Add RLS check or ensure this query respects user's access to the alert's account
  const { data: alert, error } = await supabase
    .from('alerts')
    .select('*, connected_accounts(business_name)') // Fetch related account name
    .eq('id', alertId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching alert details:', error);
    return null;
  }
  // Basic check if user should see this alert (improve with proper RLS or explicit check)
  // This is a placeholder - ideally RLS enforces this
  // const { data: userAccounts } = await supabase.from('connected_accounts').select('stripe_account_id').eq('user_id', userId);
  // if (!userAccounts?.some(acc => acc.stripe_account_id === alert?.stripe_account_id)) {
  //   return null;
  // }

  return alert;
}

export default async function AlertDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    // Handle unauthenticated access if needed, e.g., redirect to login
    // For now, assume AuthGuard handles this, but fetching requires user ID
    notFound(); // Or redirect
  }

  const alert = await getAlertDetails(supabase, params.id, session.user.id);

  if (!alert) {
    notFound();
  }

  // Format dates, etc.
  const createdAtFormatted = alert.created_at ? new Date(alert.created_at).toLocaleString() : 'N/A';
  const accountName =
    (alert.connected_accounts as any)?.business_name ?? alert.stripe_account_id ?? 'N/A';

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Alert Details</h1>
      <p className="text-sm text-slate-500 mb-6">Review the details of this security alert.</p>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{alert.alert_type}</h2>
          <p className="text-sm text-slate-600">
            Severity:{' '}
            <span
              className={`font-medium ${alert.severity === 'high' ? 'text-red-600' : alert.severity === 'medium' ? 'text-yellow-600' : 'text-gray-600'}`}
            >
              {alert.severity}
            </span>
          </p>
        </div>
        <p className="text-slate-700">{alert.message}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <p>
            <strong className="text-slate-600">Account:</strong> {accountName}
          </p>
          <p>
            <strong className="text-slate-600">Account ID:</strong> {alert.stripe_account_id}
          </p>
          <p>
            <strong className="text-slate-600">Created:</strong> {createdAtFormatted}
          </p>
          <p>
            <strong className="text-slate-600">Payout ID:</strong> {alert.stripe_payout_id || 'N/A'}
          </p>
          <p>
            <strong className="text-slate-600">Resolved:</strong> {alert.resolved ? 'Yes' : 'No'}
          </p>
          <p>
            <strong className="text-slate-600">Event ID:</strong> {alert.event_id || 'N/A'}
          </p>
        </div>

        <hr className="my-6" />

        {/* --- Feedback Component --- */}
        <AlertFeedback alertId={alert.id} />
      </div>
    </Container>
  );
}
