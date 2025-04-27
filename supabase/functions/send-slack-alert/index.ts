import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database, Tables } from '../../types/supabase.ts';

// --- Constants ---
// const MAX_SLACK_ATTEMPTS = 2; // No longer needed here
// const RETRY_DELAY_MINUTES = 1; // No longer needed here

// --- Environment Variable Access (Assuming worker passes appUrl) ---
// const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://www.dock108.ai';

// --- Helper: Build Slack Payload (Keep as is, maybe make Supabase client optional if worker passes accountName) --- //
async function buildSlackPayload(
  supabase: SupabaseClient, // Keep for fetching account name
  alert: Tables<'alerts'>,
  appUrl: string,
): Promise<object | null> {
  const ruleFriendly = alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const alertLink = `${appUrl}/guardian/alerts/${alert.id}`;
  const riskScore = alert.risk_score?.toFixed(0) ?? 'N/A';
  let accountName = alert.stripe_account_id; // Default to ID

  // Fetch connected account name
  try {
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('business_profile_name, metadata')
      .eq('stripe_account_id', alert.stripe_account_id)
      .maybeSingle();

    if (accountError) throw accountError;
    accountName =
      account?.business_profile_name || (account?.metadata as any)?.name || alert.stripe_account_id;
  } catch (error) {
    console.error(`Error fetching account name for ${alert.stripe_account_id}:`, error);
  }

  const amountDisplay = ''; // Placeholder
  const messageText = `*[Stripe Guardian]* 🚨 ${ruleFriendly} (Risk ${riskScore})\n${accountName}${amountDisplay} | <${alertLink}|View Alert>`;
  return { text: messageText };
}

/**
 * Attempts to send a single alert Slack message.
 * Called by the notification worker.
 *
 * @param supabase - Supabase client instance (for fetching account name).
 * @param appUrl - Base application URL for links.
 * @param alert - The full alert object.
 * @param slackWebhookUrl - The destination Slack webhook URL.
 * @returns {Promise<{success: boolean, error?: any}>} - Success status and error details if failed.
 */
export async function attemptSendSlack(
  supabase: SupabaseClient<Database>,
  appUrl: string,
  alert: Tables<'alerts'>,
  slackWebhookUrl: string,
): Promise<{ success: boolean; error?: any }> {
  if (!supabase || !appUrl || !alert || !slackWebhookUrl) {
    console.error('attemptSendSlack called with missing parameters');
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    const slackPayload = await buildSlackPayload(supabase, alert, appUrl);
    if (!slackPayload) {
      throw new Error('Failed to build Slack payload');
    }

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const fetchError = new Error(
        `Slack webhook failed: ${response.status} ${response.statusText}. Body: ${errorBody}`,
      );
      (fetchError as any).status = response.status;
      console.warn(`Slack API error for alert ${alert.id}:`, fetchError);
      return { success: false, error: fetchError };
    }

    console.info(`Slack alert sent successfully for alert ${alert.id}.`);
    return { success: true };
  } catch (err: any) {
    console.error(`Unexpected error sending Slack alert for alert ${alert.id}:`, err);
    return { success: false, error: err };
  }
}

// --- Original HTTP Handler (Commented out - Logic moved to worker) --- //
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// ... other imports ...

serve(async (req: Request) => {
  // ... old handler logic ...
});
*/
