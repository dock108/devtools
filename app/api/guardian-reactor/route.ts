import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { verifyWebhookConfiguration } from '@/lib/guardian/webhookVerifier';

// Flag to track if verification has run during this instance
let webhookVerified = false;

/**
 * Guardian Reactor API
 * Processes events from the event_buffer table
 * - Called by the webhook handler after event insertion
 * - Handles event processing asynchronously
 * - Will be expanded with full business logic in future PRs
 */
export async function POST(req: NextRequest) {
  // Verify webhook configuration on first event
  if (!webhookVerified) {
    // Run verification asynchronously to not block event processing
    verifyWebhookConfiguration().catch((err) => {
      logger.error({ err }, 'Failed to verify webhook configuration');
    });
    webhookVerified = true;
  }

  try {
    const { event_buffer_id } = await req.json();

    if (!event_buffer_id) {
      logger.error('Missing event_buffer_id in request body');
      return NextResponse.json({ error: 'Missing event_buffer_id' }, { status: 400 });
    }

    // Fetch the event from the buffer
    const { data: event, error } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .eq('id', event_buffer_id)
      .single();

    if (error || !event) {
      logger.error({ error, event_buffer_id }, 'Failed to fetch event from buffer');
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // TODO: Implement full event processing logic in future PRs
    // This is just a stub implementation for now

    logger.info(
      {
        event_buffer_id,
        event_type: event.type,
        stripe_event_id: event.stripe_event_id,
      },
      'Event processed by guardian-reactor',
    );

    // Mark the event as processed
    const { error: updateError } = await supabaseAdmin
      .from('event_buffer')
      .update({ processed: true })
      .eq('id', event_buffer_id);

    if (updateError) {
      logger.error({ updateError, event_buffer_id }, 'Failed to mark event as processed');
      return NextResponse.json({ error: 'Failed to mark event as processed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Event processed successfully',
    });
  } catch (err) {
    logger.error({ err }, 'Error processing event in guardian-reactor');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
