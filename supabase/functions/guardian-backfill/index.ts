import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { Stripe } from 'https://esm.sh/stripe@12.17.0?target=deno&deno-std=0.132.0'; // Use deno compatible import
import { isGuardianSupportedEvent } from '../../lib/guardian/stripeEvents.ts'; // Adjust path based on actual location
import { Database } from '../../types/supabase.ts'; // Adjust path

// --- Configuration & Environment Variables --- //
console.log('Guardian Backfill Booting...');
const platformApiKey = Deno.env.get('STRIPE_API_KEY_PLATFORM');
const backfillDays = parseInt(Deno.env.get('BACKFILL_DAYS') || '90', 10);
const batchSize = parseInt(Deno.env.get('BACKFILL_BATCH') || '300', 10); // How many events to insert/process per reactor call
const stripeApiVersion = '2022-11-15'; // Pin API version

console.log(`Required env-vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_API_KEY_PLATFORM`);
console.log(
  `Optional env-vars: BACKFILL_DAYS (default: ${backfillDays}), BACKFILL_BATCH (default: ${batchSize})`,
);

if (!platformApiKey) {
  console.error('CRITICAL: Missing STRIPE_API_KEY_PLATFORM environment variable.');
  // Optional: throw error to prevent function startup?
}

// Initialize Supabase Admin Client (direct, not helper)
const supabaseAdmin = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Initialize Stripe client
const stripe = new Stripe(platformApiKey!, {
  apiVersion: stripeApiVersion,
  httpClient: Stripe.createFetchHttpClient(), // Use Deno's fetch
});

// --- Helper Function --- //

async function updateBackfillStatus(
  accountId: string,
  status: 'running' | 'success' | 'error',
  error?: string,
  lastEventId?: string,
) {
  const updateData: Partial<Database['public']['Tables']['backfill_status']['Row']> = {
    status,
    last_error: error || null,
    completed_at: status === 'success' || status === 'error' ? new Date().toISOString() : null,
    last_event_id: lastEventId || null, // Update last processed ID on success/error or intermediate steps
  };

  console.log(
    `Updating backfill status for ${accountId} to ${status}`,
    error ? `Error: ${error}` : '',
    lastEventId ? `LastEvent: ${lastEventId}` : '',
  );
  const { error: updateError } = await supabaseAdmin
    .from('backfill_status')
    .update(updateData)
    .eq('stripe_account_id', accountId);

  if (updateError) {
    console.error(`Failed to update backfill status for ${accountId}:`, updateError.message);
  }
}

// --- Main Handler --- //
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let stripeAccountId: string;
  try {
    const body = await req.json();
    if (!body.stripe_account_id || typeof body.stripe_account_id !== 'string') {
      throw new Error('Missing or invalid stripe_account_id');
    }
    stripeAccountId = body.stripe_account_id;
  } catch (error) {
    console.error('Invalid request body:', error.message);
    return new Response(JSON.stringify({ error: 'Invalid request', details: error.message }), {
      status: 400,
    });
  }

  console.log(`Starting backfill for account: ${stripeAccountId}`);

  // --- Check Current Status --- //
  const { data: currentStatus, error: statusError } = await supabaseAdmin
    .from('backfill_status')
    .select('status, last_event_id')
    .eq('stripe_account_id', stripeAccountId)
    .single();

  if (statusError && statusError.code !== 'PGRST116') {
    // Ignore 'no rows' error initially
    console.error(
      `Error fetching current backfill status for ${stripeAccountId}:`,
      statusError.message,
    );
    return new Response(JSON.stringify({ error: 'Failed to get backfill status' }), {
      status: 500,
    });
  }

  if (currentStatus?.status === 'running') {
    console.warn(`Backfill for ${stripeAccountId} is already running. Exiting.`);
    return new Response(JSON.stringify({ message: 'Backfill already in progress' }), {
      status: 202,
    }); // Accepted, but no action needed
  }
  if (currentStatus?.status === 'success') {
    console.warn(`Backfill for ${stripeAccountId} already completed successfully. Exiting.`);
    return new Response(JSON.stringify({ message: 'Backfill already complete' }), { status: 200 });
  }

  // --- Start Processing --- //
  await updateBackfillStatus(stripeAccountId, 'running');

  try {
    const ninetyDaysAgo = Math.floor((Date.now() - backfillDays * 24 * 60 * 60 * 1000) / 1000);
    let startingAfter: string | undefined = currentStatus?.last_event_id || undefined; // Resume if possible
    let hasMore = true;
    let totalEventsProcessed = 0;
    let eventsInBatch: Database['public']['Tables']['event_buffer']['Insert'][] = [];

    console.log(
      `Fetching events for ${stripeAccountId} created >= ${new Date(ninetyDaysAgo * 1000).toISOString()}`,
    );
    if (startingAfter) {
      console.log(`Resuming after event ID: ${startingAfter}`);
    }

    while (hasMore) {
      console.log(`Fetching page starting after: ${startingAfter || '(beginning)'}...`);
      const eventsResponse = await stripe.events.list(
        {
          limit: 100, // Max limit per Stripe API
          created: { gte: ninetyDaysAgo },
          starting_after: startingAfter,
          types: [], // Fetch all initially, filter locally or specify types here if API supports broad categories
        },
        {
          stripeAccount: stripeAccountId, // Run request as the connected account
        },
      );

      if (!eventsResponse.data || eventsResponse.data.length === 0) {
        console.log('No more events found in this page.');
        hasMore = false;
      } else {
        console.log(`Fetched ${eventsResponse.data.length} events.`);
        const relevantEvents = eventsResponse.data.filter((event) =>
          isGuardianSupportedEvent(event.type),
        );
        console.log(`Found ${relevantEvents.length} relevant Guardian events.`);

        for (const event of relevantEvents) {
          // Only process if the event has data.object (some events might not)
          // @ts-expect-error TODO: Refine Stripe types if possible
          if (event.data && event.data.object) {
            eventsInBatch.push({
              stripe_event_id: event.id,
              stripe_account_id: stripeAccountId,
              type: event.type,
              // @ts-expect-error TODO: Refine Stripe types if possible
              payload: event.data.object, // Store original data part
              received_at: new Date(event.created * 1000).toISOString(), // Use event creation time
            });
          } else {
            console.warn(`Event ${event.id} (${event.type}) missing data.object, skipping.`);
          }

          totalEventsProcessed++;

          // Process in batches
          if (eventsInBatch.length >= batchSize) {
            console.log(`Processing batch of ${eventsInBatch.length} events...`);
            const { data: inserted, error: insertError } = await supabaseAdmin
              .from('event_buffer')
              .upsert(eventsInBatch, { onConflict: 'stripe_event_id' })
              .select('id');

            if (insertError) {
              // Don't stop the whole backfill, but log the error
              console.error(
                `Error inserting batch into event_buffer for ${stripeAccountId}:`,
                insertError.message,
              );
            } else if (inserted) {
              console.log(`Upserted ${inserted.length} events into buffer. Triggering reactor...`);
              // Trigger reactor for the successfully inserted events (fire and forget)
              for (const buf of inserted) {
                // @ts-expect-error TODO: Refine Stripe types if possible
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/guardian-reactor`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({ event_buffer_id: buf.id }),
                }).catch((e) =>
                  console.error(`Failed to trigger reactor for ${buf.id}:`, e.message),
                );
              }
              // Update status with the last event ID of the *successfully fetched page*
              await updateBackfillStatus(stripeAccountId, 'running', undefined, event.id);
            }
            eventsInBatch = []; // Reset batch
          }
        }
        // After processing all events in the page:
        startingAfter = eventsResponse.data[eventsResponse.data.length - 1].id;
        hasMore = eventsResponse.has_more;
        console.log(`Page processed. Has More: ${hasMore}. Next starting_after: ${startingAfter}`);
      }
      // Optional: Add a small delay to avoid hitting rate limits aggressively
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Process any remaining events in the last batch
    if (eventsInBatch.length > 0) {
      console.log(`Processing final batch of ${eventsInBatch.length} events...`);
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('event_buffer')
        .upsert(eventsInBatch, { onConflict: 'stripe_event_id' })
        .select('id');

      if (insertError) {
        console.error(
          `Error inserting final batch into event_buffer for ${stripeAccountId}:`,
          insertError.message,
        );
      } else if (inserted) {
        console.log(`Upserted ${inserted.length} final events into buffer. Triggering reactor...`);
        for (const buf of inserted) {
          // @ts-expect-error TODO: Refine Stripe types if possible
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/guardian-reactor`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ event_buffer_id: buf.id }),
          }).catch((e) => console.error(`Failed to trigger reactor for ${buf.id}:`, e.message));
        }
      }
    }

    await updateBackfillStatus(stripeAccountId, 'success', undefined, startingAfter); // Mark as success, store final event ID
    console.log(
      `Backfill successful for account: ${stripeAccountId}. Processed approx ${totalEventsProcessed} relevant events.`,
    );
    return new Response(
      JSON.stringify({ success: true, message: `Backfill complete for ${stripeAccountId}` }),
      { status: 200 },
    );
  } catch (error) {
    console.error(`Backfill failed for account ${stripeAccountId}:`, error.message, error.stack);
    await updateBackfillStatus(stripeAccountId, 'error', error.message, startingAfter); // Pass last attempted event ID
    return new Response(JSON.stringify({ error: 'Backfill failed', details: error.message }), {
      status: 500,
    });
  }
});
