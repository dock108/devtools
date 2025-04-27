import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase';
import { z } from 'zod';

// Input validation schema
const schema = z.object({
  accountId: z.string().startsWith('acct_'),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  // Validate input
  const validationResult = schema.safeParse({ accountId });
  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid account ID format.' }, { status: 400 });
  }

  const validatedAccountId = validationResult.data.accountId;

  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch status for the specific account for this user
    // RLS policy ensures the user can only fetch their own records
    const { data: statusData, error: statusError } = await supabase
      .from('account_backfill_status')
      .select('account_id, status, progress, error_message, updated_at') // Select only needed fields
      .eq('account_id', validatedAccountId)
      .maybeSingle(); // Expect 0 or 1 result due to RLS + accountId filter

    if (statusError) {
      console.error('Error fetching backfill status:', statusError);
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }

    if (!statusData) {
      // This can happen if the account exists but the status record hasn't been created yet,
      // or if the accountId doesn't belong to the user (due to RLS)
      return NextResponse.json(
        { error: 'Backfill status not found for this account.' },
        { status: 404 },
      );
    }

    // Return the status data
    return NextResponse.json(statusData);
  } catch (error: any) {
    console.error('Unexpected error in /api/backfill-status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
