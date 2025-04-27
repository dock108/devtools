import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

export async function POST(request: Request, { params }: { params: { alertId: string } }) {
  const { alertId } = params;
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');

  if (!alertId) {
    return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
  }
  if (!channel) {
    return NextResponse.json({ error: 'Channel query parameter is required' }, { status: 400 });
  }
  if (channel !== 'email' && channel !== 'slack') {
    // Validate channel
    return NextResponse.json({ error: 'Invalid channel specified' }, { status: 400 });
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

  // Check user authentication and role (Requires SERVICE_ROLE for RPC)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin (adjust based on actual role storage)
  const isAdmin = session.user?.user_metadata?.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
  }

  // Use service role client to call the RPC function
  // Note: Direct creation of service client in route handler is generally okay for admin-only actions,
  // but consider abstracting if used frequently.
  const supabaseAdmin = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use SERVICE ROLE KEY
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value, // Pass cookies if needed by RLS later
      },
      auth: {
        // Prevent storing user session when using service key
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  // Call the RPC to re-enqueue the notification
  const { error: rpcError } = await supabaseAdmin.rpc('enqueue_notification', {
    p_alert_id: alertId,
    p_channel: channel,
  });

  if (rpcError) {
    console.error(
      `Error calling enqueue_notification RPC for alert ${alertId}, channel ${channel}:`,
      rpcError,
    );
    // Provide a more specific error if possible, e.g., check rpcError.code
    return NextResponse.json(
      { error: 'Failed to enqueue retry', details: rpcError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: `Successfully queued retry for ${channel}` });
}
