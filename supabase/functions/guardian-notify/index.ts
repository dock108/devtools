import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import sgMail from 'https://esm.sh/@sendgrid/mail@7.7.0';

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // --- 2. Load Alert and Settings --- //
    console.log(`Fetching alert ${alertId}...`);
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('id, stripe_account_id, type, severity, description, triggered_at') // Added fields for notification content
      .eq('id', alertId)
      .single();

    if (alertError || !alert) {
      console.error(`Alert ${alertId} not found or error fetching:`, alertError?.message);
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(`Alert ${alertId} found for account ${alert.stripe_account_id}.`);

    // Fetch the *single* global settings row (adjust if becomes account-specific)
    console.log('Fetching global settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('id, tier, email_to, slack_webhook')
      // .eq('account_id', alert.stripe_account_id) // Uncomment and adjust if settings become per-account
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error(`Settings not found or error fetching:`, settingsError?.message);
      // Proceed without settings? Or error out? Let's error for now.
      return new Response(JSON.stringify({ error: 'Settings not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(
      `Settings found: Tier=${settings.tier}, Email=${settings.email_to}, Slack=${settings.slack_webhook ? 'configured' : 'none'}`,
    );

    // --- 4. Free-tier Account Cap --- //
    if (settings.tier === 'free') {
      console.log('Checking free tier alert count for account:', alert.stripe_account_id);
      const { count, error: countError } = await supabase
        .from('alerts')
        .select('id', { head: true, count: 'exact' })
        .eq('stripe_account_id', alert.stripe_account_id);

      if (countError) {
        console.error('Error counting alerts for free tier check:', countError.message);
        // Proceed with notification despite error? Or fail?
        // Let's proceed for now, but log error prominently.
      } else if (count !== null && count >= 50) {
        // Use >= 50, as the 50th alert should still be sent
        console.warn(
          `Free tier limit reached for account ${alert.stripe_account_id} (count: ${count}). Skipping notification for alert ${alertId}.`,
        );
        return new Response(JSON.stringify({ message: 'Free tier limit reached' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }); // Return 200 but indicate skipped
      }
      console.log(
        `Free tier count for account ${alert.stripe_account_id} is ${count}, within limit.`,
      );
    }

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

    const recipients = settings.email_to
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
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
        // Don't fail the whole function, just log the error
      }
    } else {
      console.warn('No valid recipient emails found in settings.email_to');
    }

    // --- 4. Slack Notification (Pro tier only) --- //
    if (settings.tier === 'pro' && settings.slack_webhook) {
      console.log(`Sending Slack notification for alert ${alertId} (Pro tier).`);
      const slackPayload = {
        username: slackUsername,
        text: `*Guardian Alert*\n*Type:* ${alert.type}\n*Severity:* ${alert.severity}\n*Description:* ${alert.description}\n*Account:* ${alert.stripe_account_id}\n*Time:* ${new Date(alert.triggered_at).toUTCString()}\n<fakelink.to.dashboard|View in Dashboard>`,
        // Use blocks for better formatting if desired
        // blocks: [
        //   {
        //     "type": "section",
        //     "text": {
        //       "type": "mrkdwn",
        //       "text": `*Guardian Alert*\n*Type:* ${alert.type}\n*Severity:* ${alert.severity}\n*Description:* ${alert.description}\n*Account:* ${alert.stripe_account_id}\n*Time:* ${new Date(alert.triggered_at).toUTCString()}\n<fakelink.to.dashboard|View in Dashboard>`
        //     }
        //   }
        // ]
      };

      try {
        const slackResponse = await fetch(settings.slack_webhook, {
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
        // Don't fail the whole function, just log the error
      }
    } else if (settings.tier === 'pro' && !settings.slack_webhook) {
      console.warn('Pro tier enabled, but no Slack webhook URL configured in settings.');
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
