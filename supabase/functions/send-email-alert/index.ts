import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend';
import mjml2html from 'npm:mjml';
import Stripe from 'https://esm.sh/stripe@12.5.0';

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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey || !stripeSecretKey) {
      console.error('Missing environment variables for Supabase/Resend/Stripe');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client instances
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);
    
    // Create Stripe client for admin operations
    const stripeAdmin = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      appInfo: { name: 'Stripe Guardian Admin', version: '0.1.0' },
    });
    
    // 1. Pop oldest queue row
    const { data: notif, error: notifError } = await supabase.rpc('pop_notification');
    
    if (notifError) {
      console.error('Error popping notification:', notifError);
      return new Response(JSON.stringify({ error: 'Failed to pop notification', details: notifError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to fetch alert', details: alertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const email = alert?.alert_channels?.email_to;
    if (!email) {
      return new Response('no email', { status: 204, headers: corsHeaders });
    }
    
    // Check for auto-pause capability
    let autoPauseStatus = 'skipped';
    let autoPauseMessage = '';
    
    if (alert.auto_pause && alert.alert_channels?.auto_pause && alert.stripe_payout_id) {
      try {
        await stripeAdmin.payouts.update(alert.stripe_payout_id, {
          metadata: { guardian_paused: '1' },
        });
        
        // Mark alert as resolved
        await supabase
          .from('alerts')
          .update({ resolved: true })
          .eq('id', alert.id);
          
        console.info({ 
          alertId: alert.id, 
          payoutId: alert.stripe_payout_id, 
          accountId: alert.stripe_account_id 
        }, 'Payout auto-paused');
        
        autoPauseStatus = 'success';
        autoPauseMessage = `<p style="color: #22c55e;"><strong>✓ Payout ${alert.stripe_payout_id} has been automatically paused.</strong></p>`;
      } catch (err) {
        console.error({ 
          err, 
          alertId: alert.id, 
          payoutId: alert.stripe_payout_id, 
          accountId: alert.stripe_account_id 
        }, 'Failed to auto-pause payout');
        
        autoPauseStatus = 'failed';
        autoPauseMessage = `<p style="color: #ef4444;"><strong>⚠ Failed to auto-pause payout ${alert.stripe_payout_id}. Manual action required.</strong></p>`;
      }
    }

    // 3. Render MJML template with auto-pause info
    const { html } = mjml2html(`
      <mjml>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text font-size="18px" font-weight="bold">Guardian Alert: ${alert.alert_type}</mj-text>
              <mj-text>${alert.message}</mj-text>
              ${autoPauseMessage ? `<mj-text>${autoPauseMessage}</mj-text>` : ''}
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
      return new Response(JSON.stringify({ error: 'Failed to send email', details: emailError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.info({ alertId: alert.id, email, autoPauseStatus }, 'Email alert sent');
    return new Response(JSON.stringify({ success: true, messageId: emailData?.id, autoPauseStatus }), {
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
