import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import mjml2html from 'mjml';
import { logger } from '@/lib/logger';
import { Database } from '@/types/supabase';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.RESEND_API_KEY
    ) {
      logger.error('Missing environment variables for Supabase/Resend');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create client instances
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. Pop oldest queue row
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
      logger.error({ error: emailError }, 'Failed to send email');
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.info({ alertId: alert.id, email }, 'Email alert sent');
    return NextResponse.json({ success: true, messageId: emailData?.id });
  } catch (err: any) {
    logger.error({ error: err }, 'Function error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
