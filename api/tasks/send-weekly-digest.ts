import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { logger } from '@/lib/edge-logger';
import mjml2html from '@/lib/mjml-renderer';

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
      logger.error('Missing environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const prevMonday = subWeeks(weekStart, 1);
    const prevMondayISO = prevMonday.toISOString();

    // 1. Find accounts with 0 unresolved alerts
    const { data: accounts, error: accountsError } = await supabase.rpc('accounts_without_alerts', {
      since: prevMondayISO,
    });

    if (accountsError) {
      logger.error({ error: accountsError }, 'Failed to fetch accounts without alerts');
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      logger.info('No accounts eligible for weekly digest');
      return new NextResponse(null, { status: 204 });
    }

    logger.info({ count: accounts.length }, 'Found accounts eligible for weekly digest');

    const sentCount = { success: 0, failed: 0 };

    for (const acct of accounts) {
      try {
        if (!acct.email_to) {
          continue; // Skip accounts without email
        }

        // 2. Pull screened payout volume
        const { data: agg, error: aggError } = await supabase
          .from('payout_events')
          .select('count:id, sum:amount')
          .eq('stripe_account_id', acct.account_id)
          .gte('created_at', prevMondayISO)
          .single();

        if (aggError) {
          logger.warn(
            { error: aggError, account: acct.account_id },
            'Failed to fetch payout volume',
          );
          continue;
        }

        const count = agg?.count || 0;
        const sum = agg?.sum || 0;
        const formattedSum = (sum / 100).toFixed(2);

        // 3. Generate MJML email content
        const mjmlTemplate = `
          <mjml>
            <mj-head>
              <mj-title>Guardian Weekly All-Clear Digest</mj-title>
              <mj-attributes>
                <mj-all font-family="Arial, sans-serif" />
              </mj-attributes>
            </mj-head>
            <mj-body background-color="#f9fafb">
              <mj-section padding="20px 0" background-color="#ffffff">
                <mj-column>
                  <mj-image width="120px" src="https://www.dock108.ai/logo.png" alt="Dock108" />
                </mj-column>
              </mj-section>
              
              <mj-section background-color="#ffffff" padding-top="0">
                <mj-column>
                  <mj-text font-size="24px" font-weight="bold" color="#1f2937">🎉 All-clear from Guardian!</mj-text>
                  <mj-divider border-color="#e5e7eb" />
                  <mj-text font-size="16px" color="#374151" line-height="24px">
                    Great news! No anomalies were detected from ${format(prevMonday, 'MMM d')} to ${format(weekStart, 'MMM d')}.
                  </mj-text>
                  <mj-text font-size="16px" color="#374151" line-height="24px">
                    During this period, we screened <strong>${count}</strong> payouts totaling <strong>$${formattedSum}</strong>.
                  </mj-text>
                </mj-column>
              </mj-section>
              
              <mj-section background-color="#ffffff" padding-top="0">
                <mj-column>
                  <mj-button background-color="#4f46e5" color="white" href="https://www.dock108.ai/stripe-guardian">
                    View Guardian Dashboard
                  </mj-button>
                </mj-column>
              </mj-section>
              
              <mj-section padding="10px 0" background-color="#f9fafb">
                <mj-column>
                  <mj-text font-size="12px" color="#6b7280" align="center">
                    &copy; 2025 Dock108 Inc. All rights reserved.
                  </mj-text>
                </mj-column>
              </mj-section>
            </mj-body>
          </mjml>
        `;

        // Convert MJML to HTML
        const { html } = mjml2html(mjmlTemplate);

        // 4. Send email
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Guardian <digest@dock108.ai>',
          to: acct.email_to,
          subject: 'Guardian weekly all-clear',
          html,
        });

        if (emailError) {
          logger.warn(
            { error: emailError, account: acct.account_id },
            'Failed to send weekly digest email',
          );
          sentCount.failed++;
        } else {
          logger.info({ account: acct.account_id, emailId: emailData?.id }, 'Weekly digest sent');
          sentCount.success++;
        }
      } catch (err) {
        logger.error(
          { error: err, account: acct.account_id },
          'Error processing account for weekly digest',
        );
        sentCount.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount.success,
      failed: sentCount.failed,
    });
  } catch (err) {
    logger.error({ error: err }, 'Weekly digest function error');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
