'use server';

import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase.d';
import { stripe } from '@/lib/stripe'; // Corrected path
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend'; // Import Resend SDK
// import { createClient } from '@/lib/supabase/server'; // Removed unused import

// --- Notification Helpers ---
// Basic Slack helper using fetch
async function sendSlackNotificationAction(message: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not set, skipping Slack notification.');
    return;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
    }
    console.log('Slack notification sent successfully via Server Action helper.');
  } catch (error) {
    console.error('Error sending Slack notification via Server Action helper:', error);
    // Don't throw from helper, just log the error
  }
}

// Basic Resend helper
async function sendEmailNotificationAction(to: string, subject: string, body: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set, skipping Email notification.');
    return;
  }
  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: 'DOCK108 Guardian <guardian@dock108.ai>', // Replace with your verified sender
      to: [to],
      subject: subject,
      text: body,
    });
    if (error) throw error;
    console.log(
      `Email notification sent successfully via Server Action helper to ${to}. ID:`,
      data?.id,
    );
  } catch (error) {
    console.error(`Error sending email notification via Server Action helper to ${to}:`, error);
    // Don't throw from helper, just log the error
  }
}

// --- Supabase Client Helper ---
const createSupabaseServerClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
};

// --- Server Actions ---

export async function linkStripeAccountServerAction() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized: User not logged in');
  }

  // Construct the URLs for Stripe callback
  // Ensure these URLs match your environment (localhost vs production)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // const returnUrl = `${baseUrl}/settings/connected-accounts`; // Removed
  // const refreshUrl = `${baseUrl}/settings/connected-accounts`; // Removed

  const origin = headers().get('origin');
  if (!origin) {
    return { success: false, error: 'Could not determine request origin' };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      // Note: Stripe needs an actual account ID to create a link.
      // This action seems designed to initiate linking a *new* account,
      // but accountLinks is typically for existing accounts needing onboarding.
      //
      // For initiating a *new* connection via OAuth, you usually redirect directly
      // to a pre-constructed Stripe Connect OAuth URL, often using stripe.oauth.authorizeUrl()
      // Let's assume we are using stripe.oauth.authorizeUrl() instead.

      // type: 'account_onboarding',
      // account: 'acct_xyz' // Needs an actual account ID, which we don't have yet for a new link

      // Redirecting to Stripe Connect OAuth URL construction:
      // See: https://stripe.com/docs/connect/standard-accounts#integrating-oauth
      // You need your Stripe Connect Client ID from Stripe Dashboard > Connect > Settings
      client_id: process.env.STRIPE_CLIENT_ID!,
      redirect_uri: `${baseUrl}/api/stripe/oauth/callback`, // Your configured callback handler
      response_type: 'code',
      scope: 'read_write', // Request necessary permissions
      // Optional: state parameter for security
      state: user.id, // Example: Pass user ID for verification in callback
    });

    // Construct the authorize URL
    const authorizeUrl = `https://connect.stripe.com/oauth/authorize?${new URLSearchParams(accountLink as any).toString()}`;

    console.log('Generated Stripe Connect OAuth URL:', authorizeUrl);
    return { url: authorizeUrl };
  } catch (error) {
    console.error('Error creating Stripe account link:', error);
    throw new Error('Could not initiate Stripe connection.');
  }
}

export async function disconnectStripeAccountServerAction(stripeAccountId: string) {
  if (!stripeAccountId) {
    throw new Error('Stripe Account ID is required.');
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized: User not logged in');
  }

  try {
    // 1. Deauthorize the account with Stripe
    // This revokes the application's access to the Stripe account.
    // Uses the Stripe Platform's secret key.
    // See: https://stripe.com/docs/connect/standard-accounts#disconnecting
    await stripe.oauth.deauthorize({
      client_id: process.env.STRIPE_CLIENT_ID!,
      stripe_user_id: stripeAccountId,
    });
    console.log(`Deauthorized Stripe account ${stripeAccountId} via Stripe API.`);

    // 2. Delete the account from your database
    const { error: deleteError } = await supabase
      .from('connected_accounts')
      .delete()
      .match({ user_id: user.id, stripe_account_id: stripeAccountId });

    if (deleteError) {
      console.error(`Error deleting connected account ${stripeAccountId} from DB:`, deleteError);
      throw new Error('Failed to remove account from database.');
    }
    console.log(`Deleted connected account ${stripeAccountId} for user ${user.id} from DB.`);

    // 3. Revalidate the path to refresh the list
    revalidatePath('/settings/connected-accounts');

    return { success: true };
  } catch (error) {
    console.error(`Error disconnecting Stripe account ${stripeAccountId}:`, error);
    // Determine if the error came from Stripe or DB deletion for better messaging
    if (error instanceof Error && error.message.includes('database')) {
      throw new Error('Failed to remove account locally after disconnecting from Stripe.');
    }
    if (error instanceof Error && error.message.includes('deauthorize')) {
      throw new Error('Failed to disconnect account from Stripe.');
    }
    throw new Error('Could not disconnect Stripe account.');
  }
}

export async function resumePayoutsServerAction(stripeAccountId: string) {
  if (!stripeAccountId) {
    throw new Error('Stripe Account ID is required.');
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    // Ensure user and email exist
    throw new Error('Unauthorized or user email missing.');
  }

  console.log(`User ${user.id} attempting to resume payouts for ${stripeAccountId}`);

  try {
    // Fetch account details for notification context
    const { data: account, error: fetchError } = await supabase
      .from('connected_accounts')
      .select('business_name')
      .eq('user_id', user.id)
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle();

    if (fetchError) {
      console.error(`Failed to fetch account details for ${stripeAccountId}:`, fetchError);
      // Non-fatal for payout resume, but notifications will lack name
    }
    const accountDisplayName = account?.business_name || stripeAccountId; // Use ID as fallback

    // 1. Update Stripe payout schedule to daily (or your default)
    await stripe.accounts.update(stripeAccountId, {
      settings: { payouts: { schedule: { interval: 'daily' } } },
    });
    console.log(`Updated Stripe payout schedule to daily for ${stripeAccountId}`);

    // 2. Update database record
    const { error: dbError } = await supabase
      .from('connected_accounts')
      .update({
        payouts_paused: false,
        paused_by: 'user',
        paused_reason: null, // Clear the reason
      })
      .eq('user_id', user.id) // Ensure user owns this account
      .eq('stripe_account_id', stripeAccountId);

    if (dbError) {
      console.error(
        `Error updating connected_accounts for resume payout for ${stripeAccountId}:`,
        dbError,
      );
      throw new Error('Failed to update account status in database.');
    }
    console.log(`Updated connected_accounts for resume payout for ${stripeAccountId}`);

    // 3. Trigger notification (Manual resume by user)
    const subject = `✅ Payouts Resumed for ${accountDisplayName}`;
    const messageBody = `Payouts have been manually resumed for Stripe account ${accountDisplayName} (${stripeAccountId}) by user ${user.email}.`;

    // Send notifications (fire and forget, don't block response on these)
    sendEmailNotificationAction(user.email, subject, messageBody);
    sendSlackNotificationAction(
      `✅ Payouts Resumed: Account ${accountDisplayName} (${stripeAccountId}) by user ${user.email}.`,
    );

    // 4. Revalidate path
    revalidatePath('/settings/connected-accounts');
    revalidatePath('/stripe-guardian/alerts'); // Also revalidate dashboard

    return { success: true };
  } catch (error) {
    console.error(`Error resuming payouts for ${stripeAccountId}:`, error);
    throw new Error('Could not resume payouts. Please try again.');
  }
}

export async function pausePayoutsServerAction(stripeAccountId: string) {
  if (!stripeAccountId) {
    throw new Error('Stripe Account ID is required.');
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized: User not logged in');
  }

  console.log(`User ${user.id} attempting to manually pause payouts for ${stripeAccountId}`);

  try {
    // 1. Update Stripe payout schedule to manual
    await stripe.accounts.update(stripeAccountId, {
      settings: { payouts: { schedule: { interval: 'manual' } } },
    });
    console.log(`Updated Stripe payout schedule to manual for ${stripeAccountId}`);

    // 2. Update database record
    const { error: dbError } = await supabase
      .from('connected_accounts')
      .update({
        payouts_paused: true,
        paused_by: 'user',
        paused_reason: 'manual',
      })
      .eq('user_id', user.id) // Ensure user owns this account
      .eq('stripe_account_id', stripeAccountId);

    if (dbError) {
      console.error(
        `Error updating connected_accounts for manual pause for ${stripeAccountId}:`,
        dbError,
      );
      throw new Error('Failed to update account status in database.');
    }
    console.log(`Updated connected_accounts for manual pause for ${stripeAccountId}`);

    // 3. Revalidate path
    revalidatePath('/settings/connected-accounts');

    // No notification needed for manual pause by user?

    return { success: true };
  } catch (error) {
    console.error(`Error manually pausing payouts for ${stripeAccountId}:`, error);
    throw new Error('Could not pause payouts. Please try again.');
  }
}

export async function toggleAlertsServerAction({
  stripeAccountId,
  action,
  durationMinutes,
}: {
  stripeAccountId: string;
  action: 'mute' | 'unmute';
  durationMinutes?: number;
}) {
  if (!stripeAccountId) {
    throw new Error('Stripe Account ID is required.');
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized: User not logged in');
  }

  console.log(
    `User ${user.id} attempting to ${action} alerts for ${stripeAccountId} for ${durationMinutes || 'indefinite'} minutes.`,
  );

  let newMutedUntil: string | null = null;
  if (action === 'mute') {
    if (durationMinutes === Infinity || durationMinutes === undefined || durationMinutes === null) {
      // PostgreSQL 'infinity' literal for timestamp
      newMutedUntil = 'infinity';
    } else if (typeof durationMinutes === 'number' && durationMinutes > 0) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + durationMinutes);
      newMutedUntil = now.toISOString();
    } else {
      // Default to a reasonable time if duration is invalid (e.g., 6 hours)
      console.warn(
        `Invalid durationMinutes (${durationMinutes}) provided for mute, defaulting to 360 minutes.`,
      );
      const now = new Date();
      now.setMinutes(now.getMinutes() + 360);
      newMutedUntil = now.toISOString();
    }
  } else {
    // unmute
    newMutedUntil = null;
  }

  try {
    const { error: dbError } = await supabase
      .from('connected_accounts')
      .update({
        alerts_muted_until: newMutedUntil,
      })
      .eq('user_id', user.id) // Ensure user owns this account
      .eq('stripe_account_id', stripeAccountId);

    if (dbError) {
      console.error(
        `Error updating connected_accounts for alert toggle (${action}) for ${stripeAccountId}:`,
        dbError,
      );
      throw new Error('Failed to update account alert status in database.');
    }
    console.log(
      `Updated connected_accounts for alert toggle (${action}) for ${stripeAccountId} until ${newMutedUntil || 'NULL'}.`,
    );

    revalidatePath('/settings/connected-accounts');
    // Optionally revalidate dashboard if it displays mute status
    // revalidatePath('/stripe-guardian/alerts');

    return { success: true, mutedUntil: newMutedUntil };
  } catch (error) {
    console.error(`Error toggling alerts (${action}) for ${stripeAccountId}:`, error);
    throw new Error(`Could not ${action} alerts. Please try again.`);
  }
}
