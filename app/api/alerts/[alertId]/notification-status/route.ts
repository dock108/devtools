import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

export async function GET(request: Request, { params }: { params: { alertId: string } }) {
  const { alertId } = params;
  if (!alertId) {
    return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Use anon key for user context
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    },
  );

  // Check user authentication
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the alert's delivery status
  // TODO: Add RLS or explicit check to ensure user has access to this alert
  const { data: alert, error: fetchError } = await supabase
    .from('alerts')
    .select('delivery_status')
    .eq('id', alertId)
    .maybeSingle(); // Use maybeSingle as alert might not exist

  if (fetchError) {
    console.error('Error fetching alert status:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch alert status' }, { status: 500 });
  }

  if (!alert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  return NextResponse.json({ deliveryStatus: alert.delivery_status ?? {} });
}
