import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables /*, TablesInsert */ } from '@/types/supabase'; // Adjust path as needed
import { createAdminClient as getServiceSupabaseClient } from '@/lib/supabase/admin'; // Use admin client
import { log } from '@/lib/logger'; // Assuming logger
import { attemptSendEmail } from '@/supabase/functions/send-email-alert/index'; // Placeholder path - ADJUST
import { attemptSendSlack } from '@/supabase/functions/send-slack-alert/index'; // Placeholder path - ADJUST
import { notificationsSentTotal } from '@/lib/metrics/registry'; // Import metrics

const WORKER_NAME = 'notification-worker';
const BATCH_SIZE = 10; // How many notifications to process per iteration
const POLLING_INTERVAL_MS = 5000; // Check for new jobs every 5 seconds
const INITIAL_RETRY_DELAY_MS = 1000; // Base delay for retries

// Helper to calculate exponential backoff with jitter
function calculateNextAttemptTime(attempt: number): Date {
  const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s...
  const jitter = delayMs * (Math.random() * 0.2 - 0.1); // Add +/- 10% jitter
  return new Date(Date.now() + delayMs + jitter);
}

// Helper to fetch user notification preferences
async function getUserPrefs(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('user_notification_channels')
    .select('email_to, email_enabled, slack_webhook_url, slack_enabled') // Fetch relevant fields
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    log.error({ userId, error: error.message }, 'Error fetching user notification preferences');
    return null;
  }
  return data;
}

async function processNotificationJob(
  supabase: SupabaseClient<Database>,
  job: Tables<'notification_queue'>,
) {
  const baseLogData = {
    worker: WORKER_NAME,
    job_id: job.id,
    alert_id: job.alert_id,
    channel: job.channel,
    attempt: job.attempt,
  };
  log.info(baseLogData, 'Processing notification job');

  let metricStatus = 'error'; // Default metric status

  try {
    // 1. Fetch Alert
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*, delivery_status') // Fetch delivery_status too
      .eq('id', job.alert_id)
      .single();

    if (alertError || !alert) {
      log.error(
        { ...baseLogData, error: alertError?.message },
        'Failed to fetch alert for notification job',
      );
      // Mark job as failed - cannot proceed
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_msg: 'Alert not found' })
        .eq('id', job.id);
      metricStatus = 'failed'; // Set status for metric reporting below
      notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
      return;
    }

    // 2. Fetch User ID from Connected Account
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('user_id')
      .eq('stripe_account_id', alert.stripe_account_id)
      .maybeSingle();

    if (accountError || !account?.user_id) {
      log.error(
        {
          ...baseLogData,
          stripe_account_id: alert.stripe_account_id,
          error: accountError?.message,
        },
        'Failed to fetch user_id for alert account',
      );
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_msg: 'User ID not found for account' })
        .eq('id', job.id);
      metricStatus = 'failed'; // Set status for metric reporting below
      notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
      return;
    }
    const userId = account.user_id;

    // 3. Fetch User Prefs
    const userPrefs = await getUserPrefs(supabase, userId);
    if (!userPrefs) {
      log.warn(
        { ...baseLogData, userId },
        'User preferences not found, cannot determine channel config',
      );
      // Treat as not configured - don't retry
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_msg: 'User preferences not found' })
        .eq('id', job.id);
      metricStatus = 'not_configured'; // Specific status for this case
      await updateAlertStatus(supabase, alert.id, { [job.channel]: metricStatus });
      notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
      return;
    }

    // 4. Check Channel Config & Send
    let sendResult: { success: boolean; error?: any } = {
      success: false,
      error: 'Channel not configured or disabled',
    };
    let isConfigured = false;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dock108.ai';

    if (job.channel === 'email' && userPrefs.email_enabled && userPrefs.email_to) {
      isConfigured = true;
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) throw new Error('RESEND_API_KEY env var not set');
      sendResult = await attemptSendEmail(resendApiKey, appUrl, alert, userPrefs.email_to);
    } else if (job.channel === 'slack' && userPrefs.slack_enabled && userPrefs.slack_webhook_url) {
      isConfigured = true;
      sendResult = await attemptSendSlack(supabase, appUrl, alert, userPrefs.slack_webhook_url);
    }

    // 5. Update Queue and Alert Status based on result
    if (!isConfigured) {
      log.info(
        { ...baseLogData, userId },
        `Notification channel ${job.channel} is not configured or disabled for user.`,
      );
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_msg: 'Channel not configured or disabled' })
        .eq('id', job.id);
      metricStatus = 'not_configured';
      await updateAlertStatus(supabase, alert.id, { [job.channel]: metricStatus });
    } else if (sendResult.success) {
      log.info({ ...baseLogData }, 'Notification sent successfully');
      await supabase.from('notification_queue').update({ status: 'sent' }).eq('id', job.id);
      metricStatus = 'delivered';
      await updateAlertStatus(supabase, alert.id, { [job.channel]: metricStatus });
    } else {
      const errorMessage =
        sendResult.error?.message || String(sendResult.error) || 'Unknown send error';
      log.warn({ ...baseLogData, error: errorMessage }, 'Notification send attempt failed');
      metricStatus = 'failed'; // Set status for metric reporting below

      if (job.attempt < job.max_attempts) {
        const nextAttemptTime = calculateNextAttemptTime(job.attempt);
        log.info(
          { ...baseLogData, next_attempt_at: nextAttemptTime.toISOString() },
          'Scheduling retry',
        );
        await supabase
          .from('notification_queue')
          .update({
            status: 'queued',
            next_attempt_at: nextAttemptTime.toISOString(),
            error_msg: errorMessage,
          })
          .eq('id', job.id);
        // Do not update alert status yet, it's still pending/retrying
      } else {
        log.error(
          { ...baseLogData, error: errorMessage },
          'Notification failed after max attempts',
        );
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', error_msg: errorMessage })
          .eq('id', job.id);
        await updateAlertStatus(supabase, alert.id, { [job.channel]: metricStatus });
        // Increment metric only on final failure
        notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
      }
    }

    // If not retrying (i.e., final failure or success/not_configured), increment metric
    if (metricStatus !== 'failed' || job.attempt >= job.max_attempts) {
      notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
    }
  } catch (error: any) {
    log.error(
      { ...baseLogData, error: error?.message },
      'Critical error processing notification job',
    );
    metricStatus = 'error'; // Worker error status
    notificationsSentTotal.inc({ channel: job.channel, status: metricStatus });
    // Attempt to mark as failed to prevent infinite loops
    try {
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_msg: `Worker error: ${error?.message}` })
        .eq('id', job.id);
      await updateAlertStatus(supabase, job.alert_id, { [job.channel]: metricStatus }); // Also mark alert
    } catch (updateError: any) {
      log.fatal(
        { ...baseLogData, error: updateError?.message },
        'FATAL: Failed to even mark job as failed after critical error',
      );
    }
  }
}

// Main worker loop
async function notificationWorker() {
  log.info({ worker: WORKER_NAME }, 'Worker started');
  const supabase = getServiceSupabaseClient(); // Get client once

  while (true) {
    try {
      log.debug({ worker: WORKER_NAME }, 'Fetching notification batch...');
      const { data: jobs, error: fetchError } = await supabase.rpc('fetch_notification_batch', {
        p_limit: BATCH_SIZE,
      });

      if (fetchError) {
        log.error(
          { worker: WORKER_NAME, error: fetchError.message },
          'Error fetching notification batch',
        );
        // Wait before retrying fetch
        await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS * 2));
        continue;
      }

      if (!jobs || jobs.length === 0) {
        log.debug({ worker: WORKER_NAME }, 'No pending notifications found, sleeping...');
        await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
        continue;
      }

      log.info({ worker: WORKER_NAME, count: jobs.length }, 'Processing batch...');
      // Process jobs concurrently (adjust concurrency as needed)
      await Promise.all(jobs.map((job) => processNotificationJob(supabase, job)));
    } catch (error: any) {
      log.error({ worker: WORKER_NAME, error: error?.message }, 'Error in worker main loop');
      // Wait longer after a loop error
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS * 3));
    }
  }
}

// --- Helper: Update Alert Delivery Status (Copied from send-email-alert) --- //
async function updateAlertStatus(
  supabase: SupabaseClient<Database>,
  alertId: number | string,
  status: { [key: string]: string },
) {
  // Fetch existing status, merge, and update
  const { data: currentAlert, error: fetchError } = await supabase
    .from('alerts')
    .select('delivery_status')
    .eq('id', alertId)
    .single();

  if (fetchError) {
    log.error({ alertId, error: fetchError?.message }, 'Error fetching alert to update status');
    return; // Or throw?
  }

  const currentStatus = (currentAlert?.delivery_status || {}) as { [key: string]: string };
  const newStatus = { ...currentStatus, ...status };

  const { error: updateError } = await supabase
    .from('alerts')
    .update({ delivery_status: newStatus })
    .eq('id', alertId);

  if (updateError) {
    log.error({ alertId, error: updateError?.message }, 'Error updating delivery_status');
  }
}

export default notificationWorker;
