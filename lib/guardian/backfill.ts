import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

/**
 * Creates the initial 'pending' status record for a new account backfill.
 * This might trigger a background job via DB triggers or be polled by a worker.
 */
export async function enqueueBackfill(userId: string, stripeAccountId: string): Promise<void> {
  log.info({ userId, stripeAccountId }, 'Creating initial backfill status record...');
  const supabaseAdmin = createAdminClient();

  // Insert the initial record. If it already exists (e.g., user reconnected quickly),
  // do nothing or potentially update the status back to 'pending' if desired.
  const { error } = await supabaseAdmin.from('account_backfill_status').insert({
    user_id: userId,
    account_id: stripeAccountId,
    status: 'pending',
    progress: 0,
    error_message: null, // Clear any previous error
  });
  // .onConflict('account_id') // Requires account_id to be unique constraint
  // .ignore(); // or .merge(); to update status/progress if needed

  if (error) {
    // Handle potential unique constraint violation if not using onConflict
    if (error.code === '23505') {
      // Unique violation code
      log.warn({ userId, stripeAccountId }, 'Backfill status record already exists.');
      // Optionally, update the existing record to 'pending' again?
      // const { error: updateError } = await supabaseAdmin
      //   .from('account_backfill_status')
      //   .update({ status: 'pending', progress: 0, error_message: null, updated_at: new Date().toISOString() })
      //   .eq('account_id', stripeAccountId);
      // if (updateError) log.error({ updateError }, 'Failed to reset existing backfill status');
    } else {
      log.error(
        { userId, stripeAccountId, error: error.message },
        'Failed to create backfill status record.',
      );
      // Potentially throw to signal a problem in the callback?
      // throw new Error(`Failed to enqueue backfill: ${error.message}`);
    }
  } else {
    log.info({ userId, stripeAccountId }, 'Successfully created backfill status record.');
    // If using a message queue, this is where you'd publish the job.
    // If using DB triggers, the insert itself might trigger the job.
  }
}
