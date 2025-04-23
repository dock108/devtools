import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import mjml2html from 'mjml';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { Database } from '@/types/supabase';
import { stripeAdmin } from '@/lib/stripe';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) {
      logger.error('Missing environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Create Supabase client with Service Role Key
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 1. Pop oldest queue row (FOR UPDATE SKIP LOCKED to avoid race)
    const { data: notif, error: notifError } = await supabase.rpc('pop_notification');
    
    if (notifError) {
      logger.error({ error: notifError }, 'Failed to pop notification');
      return NextResponse.json({ error: 'Failed to pop notification' }, { status: 500 });
    }
    
    if (!notif) {
      return NextResponse.json({ message: 'queue empty' }, { status: 204 });
    }

    // 2. Join alert + channel
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*, alert_channels!inner(*)')
      .eq('id', notif.alert_id)
      .maybeSingle();
    
    if (alertError) {
      logger.error({ error: alertError }, 'Failed to fetch alert');
      return NextResponse.json({ error: 'Failed to fetch alert' }, { status: 500 });
    }
    
    if (!alert?.alert_channels?.email) {
      return NextResponse.json({ message: 'no email channel' }, { status: 204 });
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
          
        logger.info({ 
          alertId: alert.id, 
          payoutId: alert.stripe_payout_id, 
          accountId: alert.stripe_account_id 
        }, 'Payout auto-paused via email alert');
        
        autoPauseStatus = 'success';
      } catch (err) {
        logger.error({ 
          error: err, 
          alertId: alert.id, 
          payoutId: alert.stripe_payout_id, 
          accountId: alert.stripe_account_id 
        }, 'Failed to auto-pause payout via email alert');
        
        autoPauseStatus = 'failed';
      }
    }

    // 3. Load and process the MJML template
    const templatePath = path.join(process.cwd(), 'emails', 'templates', 'alert.mjml');
    const mjmlTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders in template
    let processedTemplate = mjmlTemplate
      .replace('{{alert_type}}', alert.alert_type)
      .replace('{{message}}', alert.message)
      .replace('{{severity}}', alert.severity);

    // Add auto-pause info if applicable
    const autoPauseContentPlaceholder = '<!-- {{auto_pause_content}} -->';
    let autoPauseContent = '';
    
    if (autoPauseStatus === 'success') {
      autoPauseContent = `
        <mj-section background-color="#f0f7ff" padding="10px">
          <mj-column>
            <mj-text font-size="16px" color="#0066cc" font-weight="bold">
              Payout ${alert.stripe_payout_id} has been automatically paused.
            </mj-text>
          </mj-column>
        </mj-section>
      `;
    } else if (autoPauseStatus === 'failed') {
      autoPauseContent = `
        <mj-section background-color="#fff0f0" padding="10px">
          <mj-column>
            <mj-text font-size="16px" color="#cc0000" font-weight="bold">
              Failed to auto-pause payout ${alert.stripe_payout_id}. Manual action required.
            </mj-text>
          </mj-column>
        </mj-section>
      `;
    }
    
    processedTemplate = processedTemplate.replace(autoPauseContentPlaceholder, autoPauseContent);
    
    // Convert MJML to HTML
    const { html } = mjml2html(processedTemplate);

    // 4. Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Guardian Alerts <alerts@yourdomain.com>',
      to: [alert.alert_channels.email],
      subject: `Guardian Alert: ${alert.alert_type} (${alert.severity})`,
      html: html,
    });

    if (emailError) {
      logger.error({ error: emailError }, 'Failed to send email');
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.info({ alertId: alert.id, emailId: emailData?.id, autoPauseStatus }, 'Email alert sent');

    return NextResponse.json({ success: true, emailId: emailData?.id, autoPauseStatus });

  } catch (err: any) {
    logger.error({ error: err }, 'Function error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
