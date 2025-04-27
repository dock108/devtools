import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import sgMail from 'https://esm.sh/@sendgrid/mail@7.7.0';

// Type definitions (consider moving to a shared types file if possible)
interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: string;
          tier: string | null;
          email_to: string | null; // Assuming email_to is the column name
          slack_webhook: string | null; // Assuming slack_webhook is the column name
          slack_notifications_enabled?: boolean | null; // Need this for canSendSlack
          // Add other relevant fields
        };
      };
      alerts: {
        Row: {
          id: string;
          stripe_account_id: string | null;
          type: string | null;
          severity: string | null;
          description: string | null;
          triggered_at: string;
          // Add other relevant fields
        };
      };
      // Add other table types if needed
    };
    // Add other schemas if needed
  };
}
type SettingsRow = Database['public']['Tables']['settings']['Row'];
type AlertRow = Database['public']['Tables']['alerts']['Row'];

// --- Plan Helper Functions (Duplicated from lib/guardian/plan.ts) ---
const isPro = (settings: SettingsRow | null | undefined): boolean => {
  return settings?.tier === 'pro';
};

const canSendSlack = (settings: SettingsRow | null | undefined): boolean => {
  // Check if settings exist, if it's a Pro plan, and if Slack is enabled in settings
  // NOTE: Assuming settings table has `slack_notifications_enabled` boolean column
  return (
    !!settings &&
    isPro(settings) &&
    settings.slack_notifications_enabled === true &&
    !!settings.slack_webhook
  );
};

// --- End Plan Helper Functions ---

// Log required environment variables on cold start
console.log('Guardian Notify Booting...');
console.log('Required env-vars:');
console.log('  SUPABASE_URL');
console.log('  SUPABASE_SERVICE_ROLE_KEY');
console.log('  SENDGRID_API_KEY');
console.log('  FROM_EMAIL (e.g., guardian@dock108.ai)');
console.log('Optional env-vars:');
console.log('  SLACK_DEFAULT_USERNAME (defaults to Guardian)');

interface NotifyRequest {
  alert_id: string;
}

// Initialize SendGrid
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY')!);
const fromEmail = Deno.env.get('FROM_EMAIL')!;
const slackUsername = Deno.env.get('SLACK_DEFAULT_USERNAME') || 'Guardian';

serve(async (req: Request) => {
  console.log('Guardian Notify function invoked.');

  // --- 1. Handle CORS and Request Validation ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } }); // Basic CORS for now
  }
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let alertId: string;
  try {
    const body: NotifyRequest = await req.json();
    if (!body.alert_id || typeof body.alert_id !== 'string') {
      throw new Error('Missing or invalid alert_id');
    }
    alertId = body.alert_id;
    console.log('Received request for alert_id:', alertId);
  } catch (error) {
    console.error('Failed to parse request body:', error.message);
    return new Response(JSON.stringify({ error: 'Invalid request body', details: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase: SupabaseClient<Database> = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // --- 2. Load Alert and Settings --- //
    console.log(`Fetching alert ${alertId}...`);
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('id, stripe_account_id, type, severity, description, triggered_at')
      .eq('id', alertId)
      .single<AlertRow>();

    if (alertError || !alert) {
      console.error(`Alert ${alertId} not found or error fetching:`, alertError?.message);
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(`Alert ${alertId} found for account ${alert.stripe_account_id}.`);

    // Fetch the single global settings row (adjust if becomes account-specific)
    console.log('Fetching global settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global_settings')
      .single<SettingsRow>();

    if (settingsError || !settings) {
      console.error(`Settings not found or error fetching:`, settingsError?.message);
      // Proceed without settings? Or error out? Let's error for now.
      return new Response(JSON.stringify({ error: 'Settings not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(
      `Settings found: Tier=${settings.tier}, Email=${settings.email_to}, Slack Enabled=${settings.slack_notifications_enabled}, Slack Webhook=${settings.slack_webhook ? 'configured' : 'none'}`,
    );

    // --- 3. Email Notification --- //
    const emailSubject = `Guardian alert - ${alert.type} (${alert.severity})`;
    const emailText = `Hi – Guardian detected an alert:\n\nType: ${alert.type}\nSeverity: ${alert.severity}\nDescription: ${alert.description}\nAccount: ${alert.stripe_account_id}\nTime: ${new Date(alert.triggered_at).toUTCString()}\n\nView details in the Guardian Dashboard.`; // Added more detail
    const emailHtml = `<p>Hi – Guardian detected an alert:</p>
                     <ul>
                       <li><b>Type:</b> ${alert.type}</li>
                       <li><b>Severity:</b> ${alert.severity}</li>
                       <li><b>Description:</b> ${alert.description}</li>
                       <li><b>Account:</b> ${alert.stripe_account_id}</li>
                       <li><b>Time:</b> ${new Date(alert.triggered_at).toUTCString()}</li>
                     </ul>
                     <p>View details in the Guardian Dashboard.</p>`; // HTML version

    // Check if email notifications are globally enabled in settings
    if (settings.email_notifications_enabled) {
      const recipients =
        settings.email_to
          ?.split(',')
          .map((email) => email.trim())
          .filter(Boolean) ?? []; // Handle null email_to gracefully

      if (recipients.length > 0) {
        console.log(`Sending email notification for alert ${alertId} to:`, recipients.join(', '));
        try {
          await sgMail.send({
            to: recipients,
            from: fromEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
          });
          console.log(`Email sent successfully for alert ${alertId}.`);
        } catch (emailError) {
          console.error(
            `Failed to send email for alert ${alertId}:`,
            emailError.response?.body || emailError.message,
          );
        }
      } else {
        console.warn(
          'Email notifications enabled, but no valid recipient emails found in settings.email_to',
        );
      }
    } else {
      console.log('Email notifications are disabled in settings.');
    }

    // --- 4. Slack Notification (Uses canSendSlack helper) --- //
    if (canSendSlack(settings)) {
      console.log(`Sending Slack notification for alert ${alertId} (Pro tier & enabled).`);
      const slackPayload = {
        username: slackUsername,
        text: `*Guardian Alert*\n*Type:* ${alert.type}\n*Severity:* ${alert.severity}\n*Description:* ${alert.description}\n*Account:* ${alert.stripe_account_id}\n*Time:* ${new Date(alert.triggered_at).toUTCString()}\n<fakelink.to.dashboard|View in Dashboard>`,
      };
      const webhookUrl = settings.slack_webhook!;

      try {
        const slackResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        if (!slackResponse.ok) {
          const responseText = await slackResponse.text();
          throw new Error(`Slack API error: ${slackResponse.status} ${responseText}`);
        }
        console.log(`Slack notification sent successfully for alert ${alertId}.`);
      } catch (slackError) {
        console.error(
          `Failed to send Slack notification for alert ${alertId}:`,
          slackError.message,
        );
      }
    } else {
      if (!isPro(settings)) {
        console.log('Skipping Slack notification: Free tier.');
      } else if (!settings.slack_notifications_enabled) {
        console.log('Skipping Slack notification: Disabled in settings.');
      } else if (!settings.slack_webhook) {
        console.log('Skipping Slack notification: Webhook URL not configured.');
      }
    }

    console.log(`Notification processing complete for alert ${alertId}.`);
    return new Response(JSON.stringify({ success: true, alert_id: alertId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(
      'Unhandled error processing notification for alert:',
      alertId,
      error.message,
      error.stack,
    );
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
