import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { Database } from '@/types/supabase';

// Basic rate limiting (per account on local instance)
const lastSent: Record<string, number> = {};
const RATE_LIMIT_MS = 1000; // 1 second between messages

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Missing environment variables for Supabase');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create Supabase client with Service Role Key
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
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

    if (!alert?.alert_channels?.slack_webhook_url) {
      return NextResponse.json({ message: 'no channel' }, { status: 204 });
    }

    // Apply rate limiting per account
    const accountId = alert.stripe_account_id || 'unknown';
    const now = Date.now();
    const lastSentTime = lastSent[accountId] || 0;

    if (now - lastSentTime < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - (now - lastSentTime);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // 3. Format Slack block
    const payload = {
      text: `Guardian Alert (${alert.alert_type})`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `🚨 ${alert.alert_type}` } },
        { type: 'section', text: { type: 'mrkdwn', text: alert.message } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `Severity: *${alert.severity}*` }] },
      ],
    };

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

    logger.info({ alertId: alert.id, status: resp.status }, 'Slack alert sent');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error({ error: err }, 'Function error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
