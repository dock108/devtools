import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin'; // Use admin client for writes
import { log } from '@/lib/logger'; // Assuming logger is available

interface MarkReadRequest {
  alertIds: string[];
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const requestUrl = new URL(request.url);

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      log.error(
        { error: sessionError.message, path: requestUrl.pathname },
        'Error getting session in mark-read',
      );
      return NextResponse.json({ error: 'Failed to authenticate' }, { status: 401 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    let requestBody: MarkReadRequest;

    try {
      requestBody = await request.json();
      if (!Array.isArray(requestBody.alertIds) || requestBody.alertIds.length === 0) {
        throw new Error('Missing or invalid alertIds array');
      }
      // Optional: Add validation for UUID format if needed
    } catch (error) {
      log.warn(
        { error: error.message, userId, path: requestUrl.pathname },
        'Invalid request body for mark-read',
      );
      return NextResponse.json(
        { error: 'Invalid request body', details: error.message },
        { status: 400 },
      );
    }

    const { alertIds } = requestBody;
    log.info(
      { userId, alertCount: alertIds.length, path: requestUrl.pathname },
      'Marking alerts as read',
    );

    const recordsToInsert = alertIds.map((alertId) => ({
      user_id: userId,
      alert_id: alertId,
      // read_at defaults to now() in the database
    }));

    // Use admin client for inserting into alert_reads
    const { error: insertError } = await supabaseAdmin
      .from('alert_reads')
      .insert(recordsToInsert)
      // Ignore duplicates: if the user already marked an alert as read, it's fine.
      .V2 // Correct method is `upsert` with `ignoreDuplicates` or handle conflict
      .upsert(recordsToInsert, { onConflict: 'user_id, alert_id', ignoreDuplicates: true });
    // Use upsert with ignoreDuplicates=true (PostgREST v10+) or onConflict do nothing.
    // If using older PostgREST, might need a different conflict handling strategy or bulk inserts within a transaction.

    if (insertError) {
      log.error(
        {
          error: insertError.message,
          userId,
          alertCount: alertIds.length,
          path: requestUrl.pathname,
        },
        'Error inserting alert_reads',
      );
      // Potentially check for specific errors, e.g., foreign key violations if an alert was deleted
      return NextResponse.json(
        { error: 'Failed to mark alerts as read', details: insertError.message },
        { status: 500 },
      );
    }

    log.info(
      { userId, markedCount: alertIds.length, path: requestUrl.pathname },
      'Successfully marked alerts as read',
    );
    return NextResponse.json({ success: true, markedCount: alertIds.length });
  } catch (error) {
    log.error(
      { error: error.message, path: requestUrl.pathname },
      'Unhandled error in mark-read API',
    );
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
