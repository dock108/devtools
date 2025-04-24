/**
 * This is a fixed version of the email alert handler
 * that works correctly in a Vercel Edge Function environment.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import Stripe from 'stripe';

// Inline edge-compatible logger
const logger = {
  info: (data, message) => {
    console.log(
      JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data },
      }),
    );
  },

  warn: (data, message) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data },
      }),
    );
  },

  error: (data, message) => {
    console.error(
      JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data },
      }),
    );
  },

  debug: (data, message) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        JSON.stringify({
          level: 'debug',
          time: new Date().toISOString(),
          msg: message || '',
          data: typeof data === 'object' ? data : { value: data },
        }),
      );
    }
  },
};

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.RESEND_API_KEY ||
      !process.env.STRIPE_SECRET_KEY
    ) {
      logger.error('Missing environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Create Supabase client with Service Role Key
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Create Stripe client for admin operations
    const stripeAdmin = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      appInfo: { name: 'Stripe Guardian Admin', version: '0.1.0' },
    });

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

    const email = alert?.alert_channels?.email_to;
    if (!email) {
      return NextResponse.json({ message: 'no email' }, { status: 204 });
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
        await supabase.from('alerts').update({ resolved: true }).eq('id', alert.id);

        logger.info(
          {
            alertId: alert.id,
            payoutId: alert.stripe_payout_id,
            accountId: alert.stripe_account_id,
          },
          'Payout auto-paused via email alert',
        );

        autoPauseStatus = 'success';
        autoPauseMessage = `<p style="color: #22c55e;"><strong>✓ Payout ${alert.stripe_payout_id} has been automatically paused.</strong></p>`;
      } catch (err) {
        logger.error(
          {
            error: err,
            alertId: alert.id,
            payoutId: alert.stripe_payout_id,
            accountId: alert.stripe_account_id,
          },
          'Failed to auto-pause payout via email alert',
        );

        autoPauseStatus = 'failed';
        autoPauseMessage = `<p style="color: #ef4444;"><strong>⚠ Failed to auto-pause payout ${alert.stripe_payout_id}. Manual action required.</strong></p>`;
      }
    }

    // Generate basic HTML for email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Guardian Alert: ${alert.alert_type}</title>
        </head>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <header style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.dock108.ai/logo.png" alt="Dock108" style="max-width: 150px;">
          </header>
          
          <h1 style="color: #e53e3e; font-size: 22px;">Guardian Alert: ${alert.alert_type}</h1>
          <hr style="border: 1px solid #e53e3e; margin-bottom: 20px;">
          
          <p style="font-size: 16px;">${alert.message}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Account:</strong> ${alert.stripe_account_id}</p>
          
          ${autoPauseMessage}
          
          <p style="margin-bottom: 30px;">Please review this alert and take appropriate action.</p>
          
          <a href="https://www.dock108.ai/stripe-guardian/alerts" 
             style="background-color: #4338ca; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">
             View Alert Details
          </a>
          
          <footer style="margin-top: 40px; text-align: center; color: #718096; font-size: 12px;">
            <p>&copy; 2025 Dock108 Inc. All rights reserved.</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </footer>
        </body>
      </html>
    `;

    // 4. Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Guardian <alerts@dock108.ai>',
      to: email,
      subject: `Guardian ${alert.severity.toUpperCase()} alert: ${alert.alert_type}`,
      html,
    });

    if (emailError) {
      logger.error({ error: emailError }, 'Failed to send email');
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.info({ alertId: alert.id, email, autoPauseStatus }, 'Email alert sent');
    return NextResponse.json({ success: true, messageId: emailData?.id, autoPauseStatus });
  } catch (err) {
    logger.error({ error: err }, 'Function error');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
