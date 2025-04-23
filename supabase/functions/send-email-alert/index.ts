import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend';
import mjml2html from 'npm:mjml';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Missing environment variables for Supabase/Resend');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client instances
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // 1. Pop oldest queue row
    const { data: notif, error: notifError } = await supabase.rpc('pop_notification');

    if (notifError) {
      console.error('Error popping notification:', notifError);
      return new Response(
        JSON.stringify({ error: 'Failed to pop notification', details: notifError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!notif) {
      return new Response('queue empty', { status: 204, headers: corsHeaders });
    }

    // 2. Join alert + channel
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*, alert_channels!inner(*)')
      .eq('id', notif.alert_id)
      .maybeSingle();

    if (alertError) {
      console.error('Error fetching alert:', alertError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch alert', details: alertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const email = alert?.alert_channels?.email_to;
    if (!email) {
      return new Response('no email', { status: 204, headers: corsHeaders });
    }

    // 3. Render MJML template
    const { html } = mjml2html(`
      <mjml>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text font-size="18px" font-weight="bold">Guardian Alert: ${alert.alert_type}</mj-text>
              <mj-text>${alert.message}</mj-text>
              <mj-button href="https://www.dock108.ai/stripe-guardian/alerts">View Alert</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>`);

    // 4. Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Guardian <alerts@dock108.ai>',
      to: email,
      subject: `Guardian ${alert.severity.toUpperCase()} alert: ${alert.alert_type}`,
      html,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.info({ alertId: alert.id, email }, 'Email alert sent');
    return new Response(JSON.stringify({ success: true, messageId: emailData?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
