import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

const JOB_NAME = 'guardian_retention'; // Match the job name used in the procedure

export async function GET(request: Request) {
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

  // Optional: Add admin role check if this API is only for admins
  // const isAdmin = session.user?.user_metadata?.role === 'admin';
  // if (!isAdmin) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  // Fetch the last run time for the specific job
  // Assumes RLS allows authenticated users to read this table/row
  const { data, error } = await supabase
    .from('job_heartbeat')
    .select('ran_at')
    .eq('job_name', JOB_NAME)
    .maybeSingle();

  if (error) {
    console.error('Error fetching retention job heartbeat:', error);
    return NextResponse.json({ error: 'Failed to fetch retention status' }, { status: 500 });
  }

  // If no heartbeat found, return null or a specific indicator
  if (!data) {
    // You might return 404 or just null ranAt depending on how UI handles it
    return NextResponse.json({
      ranAt: null,
      message: 'Retention job has not run yet or heartbeat not found.',
    });
  }

  // Return the last run timestamp
  return NextResponse.json({ ranAt: data.ran_at });
}
