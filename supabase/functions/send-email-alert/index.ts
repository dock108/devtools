import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend';
import mjml2html from 'npm:mjml';
import Stripe from 'https://esm.sh/stripe@12.17.0?target=deno&deno-std=0.132.0';
import { Database, Tables } from '../../types/supabase.ts';

// --- Constants ---
// const MAX_EMAIL_ATTEMPTS = 3; // No longer needed here
// const INITIAL_RETRY_DELAY_MS = 1000; // No longer needed here

// --- Environment Variable Access (Assuming worker passes Resend API Key) ---
// const resendApiKey = Deno.env.get('RESEND_API_KEY');
// const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://www.dock108.ai';

// --- Helper: Render Email Template (Keep as is) --- //
function renderEmailHtml(
  alert: Tables<'alerts'>,
  appUrl: string,
  // autoPauseMessage: string // Auto-pause logic likely moved to worker or trigger
): string {
  const ruleFriendly = alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const alertLink = `${appUrl}/guardian/alerts/${alert.id}`;
  let scoreBadgeColor = '#6b7280';
  let scoreTextColor = '#ffffff';
  if (alert.risk_score !== null && alert.risk_score !== undefined) {
    if (alert.risk_score > 60) scoreBadgeColor = '#ef4444';
    else if (alert.risk_score >= 30) scoreBadgeColor = '#f59e0b';
    else scoreBadgeColor = '#22c55e';
  }
  const riskScoreDisplay =
    alert.risk_score !== null && alert.risk_score !== undefined
      ? alert.risk_score.toFixed(0)
      : 'N/A';

  // Simplified template - remove auto-pause text, assuming it's handled elsewhere
  const { html } = mjml2html(`
    <mjml>
      <mj-head>
          <mj-style>
              .score-badge { background-color: ${scoreBadgeColor}; color: ${scoreTextColor}; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; margin-left: 8px; }
          </mj-style>
      </mj-head>
      <mj-body background-color="#f3f4f6">
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column>
            <mj-text font-size="20px" font-weight="bold" color="#11182b">Guardian Alert: ${ruleFriendly}</mj-text>
            <mj-text font-size="14px" color="#4b5563" line-height="1.6">Rule: ${ruleFriendly}</mj-text>
            <mj-text font-size="14px" color="#4b5563" line-height="1.6">Severity: ${alert.severity?.toUpperCase()}</mj-text>
            <mj-text font-size="14px" color="#4b5563" line-height="1.6">
              Risk Score: <span class="score-badge">${riskScoreDisplay}</span>
            </mj-text>
            <mj-divider border-color="#e5e7eb"></mj-divider>
            <mj-text font-size="16px" color="#374151" padding-top="10px">${alert.message || 'No specific message.'}</mj-text>
            <mj-button href="${alertLink}" background-color="#4f46e5" color="#ffffff" font-size="14px" padding="15px 0px">View Alert Details</mj-button>
            <mj-text font-size="12px" color="#9ca3af" align="center" padding-top="20px">
              Triggered at: ${new Date(alert.triggered_at || Date.now()).toLocaleString()}
            </mj-text>
          </mj-column>
        </mj-section>
        <mj-section>
           <mj-column>
              <mj-text align="center" font-size="12px" color="#9ca3af">&copy; DOCK108 - You received this because notifications are enabled for your account.</mj-text>
           </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`);
  return html;
}

/**
 * Attempts to send a single alert email using Resend.
 * Called by the notification worker.
 *
 * @param resendApiKey - Resend API key passed by the worker.
 * @param appUrl - Base application URL for links.
 * @param alert - The full alert object.
 * @param recipientEmail - The email address to send to.
 * @returns {Promise<{success: boolean, error?: any}>} - Success status and error details if failed.
 */
export async function attemptSendEmail(
  resendApiKey: string,
  appUrl: string,
  alert: Tables<'alerts'>,
  recipientEmail: string,
): Promise<{ success: boolean; error?: any }> {
  if (!resendApiKey || !appUrl || !alert || !recipientEmail) {
    console.error('attemptSendEmail called with missing parameters');
    return { success: false, error: 'Missing required parameters' };
  }

  const resend = new Resend(resendApiKey);
  const ruleFriendly = alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const subject = `🚨 [Stripe Guardian] Alert: ${ruleFriendly}`;
  const html = renderEmailHtml(alert, appUrl);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Guardian <alerts@dock108.ai>',
      to: recipientEmail,
      subject: subject,
      html: html,
    });

    if (error) {
      console.warn(`Resend API error for alert ${alert.id}:`, error);
      return { success: false, error: error };
    }

    console.info(
      `Email sent successfully via Resend for alert ${alert.id} to ${recipientEmail}. Message ID: ${data?.id}`,
    );
    return { success: true };
  } catch (err: any) {
    console.error(`Unexpected error sending email for alert ${alert.id}:`, err);
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
