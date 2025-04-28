import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FEEDBACK_RECIPIENT_EMAIL = process.env.FEEDBACK_RECIPIENT_EMAIL; // e.g., 'founders@example.com'
const RATE_LIMIT_MINUTES = 10;

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn('[API/Feedback] RESEND_API_KEY not set. Feedback email notifications disabled.');
}

export async function POST(request: Request) {
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
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  let feedbackData: { message?: string; email?: string };

  try {
    feedbackData = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, email } = feedbackData;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required and cannot be empty' }, { status: 400 });
  }
  if (email && typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // --- Rate Limiting Check ---
  try {
    const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();

    const { data: recentFeedback, error: rateLimitError } = await supabase
      .from('feedback')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', rateLimitCutoff) // Check for feedback within the window
      .limit(1); // Only need to know if at least one exists

    if (rateLimitError) {
      console.error('[API/Feedback] Rate limit check failed:', rateLimitError);
      // Proceed cautiously, maybe allow submission but log the error
    } else if (recentFeedback && recentFeedback.length > 0) {
      console.log(`[API/Feedback] Rate limit hit for user: ${userId}`);
      return NextResponse.json(
        { error: `Rate limit exceeded. Please wait ${RATE_LIMIT_MINUTES} minutes.` },
        { status: 429 },
      );
    }
  } catch (e) {
    console.error('[API/Feedback] Exception during rate limit check:', e);
    // Fail open or closed? Failing open here.
  }
  // --- End Rate Limiting Check ---

  // Insert feedback into the database
  const { error: insertError } = await supabase.from('feedback').insert({
    user_id: userId,
    message: message.trim(),
    email: email?.trim() || session.user.email, // Use provided email or user's auth email
  });

  if (insertError) {
    console.error('[API/Feedback] Failed to insert feedback:', insertError);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: insertError.message },
      { status: 500 },
    );
  }

  // Send notification (Email via Resend)
  if (resend && FEEDBACK_RECIPIENT_EMAIL) {
    try {
      await resend.emails.send({
        from: 'Guardian Feedback <feedback@noreply.dock108.ai>', // TODO: Configure verified sender domain
        to: FEEDBACK_RECIPIENT_EMAIL,
        subject: `New Guardian Feedback from ${session.user.email}`,
        html: `
                    <p><strong>User:</strong> ${session.user.email} (${userId})</p>
                    <p><strong>Provided Email:</strong> ${email || 'N/A'}</p>
                    <p><strong>Message:</strong></p>
                    <pre>${message.trim()}</pre>
                `,
      });
      console.log(`[API/Feedback] Sent feedback notification for user: ${userId}`);
      return NextResponse.json({ message: 'Feedback submitted' }, { status: 201 });
    } catch {
      // console.error('Feedback error:', e);
      return NextResponse.json({ error: 'Server error submitting feedback' }, { status: 500 });
    }
  } else if (!resend) {
    console.warn('[API/Feedback] Skipping email notification (Resend not configured).');
  } else if (!FEEDBACK_RECIPIENT_EMAIL) {
    console.warn('[API/Feedback] Skipping email notification (FEEDBACK_RECIPIENT_EMAIL not set).');
  }

  return NextResponse.json({ message: 'Feedback submitted successfully' }, { status: 201 });
}
