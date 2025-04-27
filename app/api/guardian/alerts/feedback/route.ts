import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin'; // Use admin for upsert/read counts
import { Database } from '@/types/supabase';
// import { logger } from '@/lib/logger'; // Assuming logger exists

// --- Metrics Setup (Placeholder - Requires actual prom-client integration) --- //
import { register, Counter } from 'prom-client'; // Assuming metrics setup

// Ensure this is only registered once
let falsePositiveCounter = register.getSingleMetric(
  'guardian_alert_false_positive_feedback_total',
) as Counter | undefined;
if (!falsePositiveCounter) {
  falsePositiveCounter = new Counter({
    name: 'guardian_alert_false_positive_feedback_total',
    help: 'Total number of alerts marked as false positive, partitioned by rule type.',
    labelNames: ['rule'],
  });
}
// --- End Metrics Setup --- //

// Explicitly mark route as dynamic to prevent caching issues
export const dynamic = 'force-dynamic';

// --- POST Handler (Submit/Update Feedback) --- //
export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    },
  );

  // logger.info('Received POST request to /api/guardian/alerts/feedback');
  console.log('Received POST request to /api/guardian/alerts/feedback');

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!session || sessionError) {
    // logger.warn('Unauthorized feedback submission attempt', { error: sessionError });
    console.warn('Unauthorized feedback submission attempt', { error: sessionError });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { alertId: string; verdict: 'false_positive' | 'legit'; comment?: string };
  try {
    body = await req.json();
    if (
      !body.alertId ||
      typeof body.alertId !== 'string' ||
      !body.verdict ||
      (body.verdict !== 'false_positive' && body.verdict !== 'legit')
    ) {
      throw new Error('Missing or invalid alertId or verdict');
    }
    // logger.info('Parsed feedback request body', { userId: session.user.id, alertId: body.alertId, verdict: body.verdict });
    console.log('Parsed feedback request body', {
      userId: session.user.id,
      alertId: body.alertId,
      verdict: body.verdict,
    });
  } catch (error: any) {
    // logger.warn('Invalid feedback request body', { error: error.message });
    console.warn('Invalid feedback request body', { error: error.message });
    return NextResponse.json(
      { error: 'Invalid request body', details: error.message },
      { status: 400 },
    );
  }

  try {
    const feedbackData: Database['public']['Tables']['alert_feedback']['Insert'] = {
      alert_id: body.alertId,
      user_id: session.user.id,
      verdict: body.verdict,
      comment: body.comment || null,
      // created_at and updated_at are handled by DB defaults/triggers
    };

    const { data, error: upsertError } = await supabaseAdmin
      .from('alert_feedback')
      .upsert(feedbackData, {
        onConflict: 'alert_id, user_id', // Specify conflict target
      })
      .select('id') // Select something to confirm success
      .single(); // Expect one row affected

    if (upsertError) {
      // logger.error('Error upserting alert feedback', { userId: session.user.id, alertId: body.alertId, error: upsertError });
      console.error('Error upserting alert feedback', {
        userId: session.user.id,
        alertId: body.alertId,
        error: upsertError,
      });
      throw upsertError;
    }

    // logger.info('Successfully recorded alert feedback', { userId: session.user.id, alertId: body.alertId, feedbackId: data?.id });
    console.log('Successfully recorded alert feedback', {
      userId: session.user.id,
      alertId: body.alertId,
      feedbackId: data?.id,
    });

    // --- Metrics Increment --- //
    // Increment counter if it was a false positive
    if (body.verdict === 'false_positive' && falsePositiveCounter) {
      try {
        // Need to fetch the alert rule type
        const { data: alertData, error: alertFetchError } = await supabaseAdmin
          .from('alerts')
          .select('alert_type')
          .eq('id', body.alertId)
          .maybeSingle();

        if (alertFetchError || !alertData) {
          // logger.error('Failed to fetch alert type for metrics', { alertId: body.alertId, error: alertFetchError });
          console.error('Failed to fetch alert type for metrics', {
            alertId: body.alertId,
            error: alertFetchError,
          });
        } else {
          falsePositiveCounter.labels(alertData.alert_type || 'unknown').inc();
          // logger.info('Incremented false_positive_total metric', { rule: alertData.alert_type });
          console.log('Incremented false_positive_total metric', { rule: alertData.alert_type });
        }
      } catch (metricError: any) {
        // logger.error('Error incrementing metrics counter', { error: metricError });
        console.error('Error incrementing metrics counter', { error: metricError.message });
      }
    }
    // --- End Metrics Increment --- //

    return NextResponse.json({ success: true, feedbackId: data?.id }, { status: 200 }); // 200 OK indicates update/creation
  } catch (error: any) {
    // logger.error('Internal server error processing feedback', { userId: session.user.id, alertId: body.alertId, error: error.message });
    console.error('Internal server error processing feedback', {
      userId: session.user.id,
      alertId: body.alertId,
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to record feedback', details: error.message },
      { status: 500 },
    );
  }
}

// --- GET Handler (Fetch Feedback Counts) --- //
export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    },
  );

  // logger.info('Received GET request to /api/guardian/alerts/feedback');
  console.log('Received GET request to /api/guardian/alerts/feedback');

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!session || sessionError) {
    // logger.warn('Unauthorized feedback count request', { error: sessionError });
    console.warn('Unauthorized feedback count request', { error: sessionError });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const alertId = url.searchParams.get('alertId');

  if (!alertId || typeof alertId !== 'string') {
    // logger.warn('Missing or invalid alertId query parameter for GET feedback');
    console.warn('Missing or invalid alertId query parameter for GET feedback');
    return NextResponse.json({ error: 'Missing or invalid alertId parameter' }, { status: 400 });
  }

  // logger.info('Fetching feedback counts', { userId: session.user.id, alertId });
  console.log('Fetching feedback counts', { userId: session.user.id, alertId });

  try {
    // Use an RPC function for aggregation might be more efficient, but direct query is fine for now.
    const { data, error: countError } = await supabaseAdmin
      .from('alert_feedback')
      .select('verdict, count', { count: 'exact' }) // Select verdict and count
      .eq('alert_id', alertId)
      .in('verdict', ['false_positive', 'legit']) // Ensure we only count valid verdicts
      .filter('user_id', 'not.is', 'null') // Exclude potentially null user_ids if set null on delete
      .returns<{ verdict: string; count: number }[]>(); // Type the return

    if (countError) {
      // logger.error('Error fetching feedback counts', { userId: session.user.id, alertId, error: countError });
      console.error('Error fetching feedback counts', {
        userId: session.user.id,
        alertId,
        error: countError,
      });
      throw countError;
    }

    // Process the counts into the desired format
    const counts = {
      false_positive: 0,
      legit: 0,
    };

    data?.forEach((row) => {
      if (row.verdict === 'false_positive') {
        counts.false_positive = row.count;
      } else if (row.verdict === 'legit') {
        counts.legit = row.count;
      }
    });

    // logger.info('Successfully fetched feedback counts', { userId: session.user.id, alertId, counts });
    console.log('Successfully fetched feedback counts', {
      userId: session.user.id,
      alertId,
      counts,
    });

    return NextResponse.json(counts, { status: 200 });
  } catch (error: any) {
    // logger.error('Internal server error fetching feedback counts', { userId: session.user.id, alertId, error: error.message });
    console.error('Internal server error fetching feedback counts', {
      userId: session.user.id,
      alertId,
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to fetch feedback counts', details: error.message },
      { status: 500 },
    );
  }
}
