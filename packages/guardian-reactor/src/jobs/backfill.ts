import { Stripe } from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';
import { stripe } from '@/lib/stripe'; // Use the configured Stripe client
import { Database } from '@/types/supabase'; // Assuming generated types

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const BUFFER_INSERT_BATCH_SIZE = 100; // Adjust as needed

type BackfillStatusRecord = Database['public']['Tables']['account_backfill_status']['Row'];

async function updateBackfillStatus(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  accountId: string,
  updates: Partial<Omit<BackfillStatusRecord, 'id' | 'account_id' | 'user_id' | 'created_at'>>,
) {
  const { error } = await supabaseAdmin
    .from('account_backfill_status')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('account_id', accountId);

  if (error) {
    log.error({ accountId, error: error.message, updates }, 'Failed to update backfill status');
    // Potentially throw or handle retry?
  }
}

async function getDecryptedTokens(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  accountId: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const keyId = process.env.SODIUM_ENCRYPTION_KEY_ID;
  if (!keyId) {
    log.error({ accountId }, 'SODIUM_ENCRYPTION_KEY_ID missing for token decryption.');
    throw new Error('Encryption key configuration error.');
  }

  const { data, error } = await supabaseAdmin.rpc('get_decrypted_stripe_tokens', {
    p_stripe_account_id: accountId,
    p_key_id: keyId,
  });

  if (error) {
    log.error(
      { accountId, error: error.message },
      'Failed to call get_decrypted_stripe_tokens RPC',
    );
    return null;
  }

  if (!data || !data.access_token || !data.refresh_token) {
    log.warn({ accountId }, 'Decryption function returned null or incomplete tokens.');
    return null;
  }

  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function processBackfill(accountId: string, userId: string): Promise<void> {
  const supabaseAdmin = createAdminClient();
  log.info({ accountId, userId }, 'Starting backfill process...');

  try {
    // 1. Mark as running
    await updateBackfillStatus(supabaseAdmin, accountId, {
      status: 'running',
      progress: 0,
      error_message: null,
    });

    // 2. Get Decrypted Tokens
    // Note: This example uses the access token directly. In a real-world scenario,
    // you might want to use the refresh token to get a fresh access token if needed,
    // or preferably, use a restricted API key if possible for the backfill.
    const tokens = await getDecryptedTokens(supabaseAdmin, accountId);
    if (!tokens) {
      throw new Error('Could not retrieve decrypted Stripe tokens.');
    }

    // Create a temporary Stripe client authenticated as the connected account
    // WARNING: Be extremely careful with the access token. Do not log it.
    // Consider if a more restricted key can be used/created for backfill.
    const stripeAsAccount = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: stripe.VERSION, // Use same API version
      stripeAccount: accountId,
      // Note: Using the account's access token directly is generally discouraged for long-running server processes.
      // The standard practice is to use the platform's secret key and the `stripeAccount` header.
      // However, if `events.list` REQUIRES the access token for connected accounts (verify this in Stripe docs),
      // this is necessary. If not, REMOVE this `apiKey` override.
      apiKey: tokens.accessToken, // !! Use with caution - only if absolutely required !!
    });

    // 3. Calculate start time
    const startTime = Math.floor((Date.now() - NINETY_DAYS_MS) / 1000);
    const endTime = Math.floor(Date.now() / 1000); // Fetch up to now
    const totalDuration = endTime - startTime;

    log.info(
      { accountId, startTime: new Date(startTime * 1000).toISOString() },
      'Fetching events since 90 days ago.',
    );

    // 4. Fetch & Process Events
    let eventBufferBatch: Partial<Database['public']['Tables']['event_buffer']['Insert']>[] = [];
    let lastEventTimestamp = startTime;
    let processedEventCount = 0;

    for await (const event of stripeAsAccount.events.list({
      created: { gte: startTime },
      limit: 100,
    })) {
      // TODO: Filter for specific event types needed by Guardian if possible?
      // enabled_events in webhook config doesn't filter historical events via API.

      eventBufferBatch.push({
        account_id: accountId,
        event_id: event.id,
        event_type: event.type,
        payload: event as any, // Store the full event payload
        source: 'backfill',
        // status defaults to 'pending' in DB schema?
      });

      processedEventCount++;
      lastEventTimestamp = event.created; // Keep track of the latest event time processed

      if (eventBufferBatch.length >= BUFFER_INSERT_BATCH_SIZE) {
        const { error: insertError } = await supabaseAdmin
          .from('event_buffer')
          .insert(eventBufferBatch);
        if (insertError) {
          throw new Error(`Failed to insert event buffer batch: ${insertError.message}`);
        }
        log.debug(
          { accountId, count: eventBufferBatch.length },
          'Inserted event batch into buffer.',
        );
        eventBufferBatch = []; // Reset batch

        // Update progress - estimate based on time window covered
        const elapsedDuration = lastEventTimestamp - startTime;
        const progress = Math.min(
          100,
          Math.max(0, Math.floor((elapsedDuration / totalDuration) * 100)),
        );
        await updateBackfillStatus(supabaseAdmin, accountId, {
          progress: progress,
          status: 'running',
        });
      }
    }

    // Insert any remaining events in the last batch
    if (eventBufferBatch.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('event_buffer')
        .insert(eventBufferBatch);
      if (insertError) {
        throw new Error(`Failed to insert final event buffer batch: ${insertError.message}`);
      }
      log.debug(
        { accountId, count: eventBufferBatch.length },
        'Inserted final event batch into buffer.',
      );
    }

    log.info({ accountId, processedEventCount }, 'Backfill event fetching complete.');

    // 5. Mark as complete
    await updateBackfillStatus(supabaseAdmin, accountId, { status: 'completed', progress: 100 });
    log.info({ accountId }, 'Backfill process completed successfully.');
  } catch (error: any) {
    log.error(
      { accountId, userId, error: error.message, stack: error.stack },
      'Error during backfill process',
    );
    // 6. Mark as failed
    await updateBackfillStatus(supabaseAdmin, accountId, {
      status: 'failed',
      error_message: error.message,
    });
  }
}
