import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { logger } from '@/lib/logger';

describe('Alert Notification Trigger', () => {
  // Admin client with service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Test data
  const testAlert = {
    alert_type: 'VELOCITY',
    severity: 'high',
    message: 'Test alert for notification trigger',
    stripe_account_id: 'acct_test123',
    resolved: false,
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await supabaseAdmin.from('alerts').delete().eq('message', testAlert.message);
  });

  it('should create a pending notification when an alert is inserted', async () => {
    // Get current count of pending notifications
    const { count: initialCount, error: countError } = await supabaseAdmin
      .from('pending_notifications')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error({ error: countError }, 'Failed to get initial count');
      throw countError;
    }

    // Insert a test alert
    const { data: alert, error: insertError } = await supabaseAdmin
      .from('alerts')
      .insert(testAlert)
      .select()
      .single();

    if (insertError) {
      logger.error({ error: insertError }, 'Failed to insert test alert');
      throw insertError;
    }

    expect(alert).toBeTruthy();
    expect(alert.id).toBeTruthy();

    // Check for a new pending notification
    const { count: newCount, error: newCountError } = await supabaseAdmin
      .from('pending_notifications')
      .select('*', { count: 'exact', head: true });

    if (newCountError) {
      logger.error({ error: newCountError }, 'Failed to get new count');
      throw newCountError;
    }

    // Should have exactly one more notification
    expect(newCount).toBe(initialCount! + 1);

    // Verify the notification is for our alert
    const { data: notifications, error: notifError } = await supabaseAdmin
      .from('pending_notifications')
      .select('*')
      .eq('alert_id', alert.id);

    if (notifError) {
      logger.error({ error: notifError }, 'Failed to get notifications');
      throw notifError;
    }

    expect(notifications).toHaveLength(1);
    expect(notifications[0].alert_id).toBe(alert.id);

    // Clean up
    await supabaseAdmin.from('alerts').delete().eq('id', alert.id);

    // Verify cascade delete worked
    const { count: finalCount, error: finalCountError } = await supabaseAdmin
      .from('pending_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('alert_id', alert.id);

    if (finalCountError) {
      logger.error({ error: finalCountError }, 'Failed to get final count');
      throw finalCountError;
    }

    // Should be removed via cascade
    expect(finalCount).toBe(0);
  });
});
