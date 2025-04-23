import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.5.0';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basic rate limiting (per account on local instance)
const lastSent: Record<string, number> = {};
const RATE_LIMIT_MS = 1000; // 1 second between messages

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      console.error('Missing environment variables for Supabase/Stripe');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with Service Role Key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create Stripe client for admin operations
    const stripeAdmin = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      appInfo: { name: 'Stripe Guardian Admin', version: '0.1.0' },
    });
    
    // 1. Pop oldest queue row (FOR UPDATE SKIP LOCKED to avoid race)
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

    if (!alert?.alert_channels?.slack_webhook_url) {
      return new Response('no channel', { status: 204, headers: corsHeaders });
    }

    // Check for auto-pause capability
    let autoPauseStatus = 'skipped';
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
      } catch (err) {
        console.error({ 
          err, 
          alertId: alert.id, 
          payoutId: alert.stripe_payout_id, 
          accountId: alert.stripe_account_id 
        }, 'Failed to auto-pause payout');
        
        autoPauseStatus = 'failed';
      }
    }

    // Apply rate limiting per account
    const accountId = alert.stripe_account_id || 'unknown';
    const now = Date.now();
    const lastSentTime = lastSent[accountId] || 0;

    if (now - lastSentTime < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - (now - lastSentTime);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // 3. Format Slack block with auto-pause info
    const payload = {
      text: `Guardian Alert (${alert.alert_type})`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `🚨 ${alert.alert_type}` } },
        { type: 'section', text: { type: 'mrkdwn', text: alert.message } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `Severity: *${alert.severity}*` }] },
      ],
    };
    
    // Add auto-pause info if applicable
    if (autoPauseStatus === 'success') {
      payload.blocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `:white_check_mark: *Payout ${alert.stripe_payout_id} has been automatically paused.*` 
        }
      });
    } else if (autoPauseStatus === 'failed') {
      payload.blocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `:warning: *Failed to auto-pause payout ${alert.stripe_payout_id}. Manual action required.*` 
        }
      });
    }

    // 4. Post to Slack
    const resp = await fetch(alert.alert_channels.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Update rate limiting record
    lastSent[accountId] = Date.now();

    // Always add a small delay for rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 msg / sec

    console.info({ alertId: alert.id, status: resp.status, autoPauseStatus }, 'Slack alert sent');

    return new Response(JSON.stringify({ success: true, autoPauseStatus }), {
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
