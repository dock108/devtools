import { supabaseAdmin, createTestClient } from '../helpers/supabase';
import { v4 as uuidv4 } from 'uuid';

describe('Guardian Tables Row Level Security', () => {
  const userId1 = uuidv4();
  const userId2 = uuidv4();
  const stripeAccount1 = 'acct_' + uuidv4().replace(/-/g, '');
  const stripeAccount2 = 'acct_' + uuidv4().replace(/-/g, '');
  const testAlertId = uuidv4();
  const testPayoutEventId = uuidv4();
  const testNotificationId = uuidv4();

  beforeAll(async () => {
    // Create test users
    await supabaseAdmin.auth.admin.createUser({
      id: userId1,
      email: `test-user1-${userId1.substring(0, 8)}@example.com`,
      password: 'password123',
      email_confirm: true,
    });

    await supabaseAdmin.auth.admin.createUser({
      id: userId2,
      email: `test-user2-${userId2.substring(0, 8)}@example.com`,
      password: 'password123',
      email_confirm: true,
    });

    // Create connected accounts
    await supabaseAdmin
      .from('connected_accounts')
      .insert([
        { 
          user_id: userId1, 
          stripe_account_id: stripeAccount1,
          details: { name: 'Test Account 1' }
        },
        { 
          user_id: userId2, 
          stripe_account_id: stripeAccount2,
          details: { name: 'Test Account 2' }
        }
      ]);

    // Insert test data for alerts
    await supabaseAdmin
      .from('alerts')
      .insert({
        id: testAlertId,
        stripe_account_id: stripeAccount1,
        type: 'payout_failure',
        status: 'pending',
        details: { message: 'Test alert' }
      });

    // Insert test data for payout_events
    await supabaseAdmin
      .from('payout_events')
      .insert({
        id: testPayoutEventId,
        stripe_account_id: stripeAccount1,
        payout_id: 'po_' + uuidv4().replace(/-/g, ''),
        type: 'created',
        data: { amount: 1000 }
      });

    // Insert test data for pending_notifications
    await supabaseAdmin
      .from('pending_notifications')
      .insert({
        id: testNotificationId,
        stripe_account_id: stripeAccount1,
        type: 'email',
        status: 'pending',
        content: { subject: 'Test notification', body: 'This is a test' }
      });
  });

  afterAll(async () => {
    // Clean up test data
    await supabaseAdmin.from('alerts').delete().eq('id', testAlertId);
    await supabaseAdmin.from('payout_events').delete().eq('id', testPayoutEventId);
    await supabaseAdmin.from('pending_notifications').delete().eq('id', testNotificationId);
    
    await supabaseAdmin.from('connected_accounts')
      .delete()
      .in('stripe_account_id', [stripeAccount1, stripeAccount2]);
    
    await supabaseAdmin.auth.admin.deleteUser(userId1);
    await supabaseAdmin.auth.admin.deleteUser(userId2);
  });

  test('User can access their own alerts but not others', async () => {
    const clientUser1 = await createTestClient(userId1);
    const clientUser2 = await createTestClient(userId2);

    // User 1 should see their own alert
    const { data: user1Alerts, error: error1 } = await clientUser1
      .from('alerts')
      .select('*')
      .eq('id', testAlertId);
    
    expect(error1).toBeNull();
    expect(user1Alerts).toHaveLength(1);
    expect(user1Alerts![0].id).toBe(testAlertId);

    // User 2 should not see User 1's alert
    const { data: user2Alerts, error: error2 } = await clientUser2
      .from('alerts')
      .select('*')
      .eq('id', testAlertId);
    
    expect(error2).toBeNull();
    expect(user2Alerts).toHaveLength(0);
  });

  test('User can access their own payout events but not others', async () => {
    const clientUser1 = await createTestClient(userId1);
    const clientUser2 = await createTestClient(userId2);

    // User 1 should see their own payout event
    const { data: user1Events, error: error1 } = await clientUser1
      .from('payout_events')
      .select('*')
      .eq('id', testPayoutEventId);
    
    expect(error1).toBeNull();
    expect(user1Events).toHaveLength(1);
    expect(user1Events![0].id).toBe(testPayoutEventId);

    // User 2 should not see User 1's payout event
    const { data: user2Events, error: error2 } = await clientUser2
      .from('payout_events')
      .select('*')
      .eq('id', testPayoutEventId);
    
    expect(error2).toBeNull();
    expect(user2Events).toHaveLength(0);
  });

  test('User can access their own notifications but not others', async () => {
    const clientUser1 = await createTestClient(userId1);
    const clientUser2 = await createTestClient(userId2);

    // User 1 should see their own notification
    const { data: user1Notifications, error: error1 } = await clientUser1
      .from('pending_notifications')
      .select('*')
      .eq('id', testNotificationId);
    
    expect(error1).toBeNull();
    expect(user1Notifications).toHaveLength(1);
    expect(user1Notifications![0].id).toBe(testNotificationId);

    // User 2 should not see User 1's notification
    const { data: user2Notifications, error: error2 } = await clientUser2
      .from('pending_notifications')
      .select('*')
      .eq('id', testNotificationId);
    
    expect(error2).toBeNull();
    expect(user2Notifications).toHaveLength(0);
  });

  test('User can insert data only for their own stripe accounts', async () => {
    const clientUser1 = await createTestClient(userId1);
    
    // User should be able to insert for their own account
    const { data: insertOwnData, error: insertOwnError } = await clientUser1
      .from('alerts')
      .insert({
        stripe_account_id: stripeAccount1,
        type: 'balance_low',
        status: 'pending',
        details: { message: 'Test own insert' }
      })
      .select();
    
    expect(insertOwnError).toBeNull();
    expect(insertOwnData).toHaveLength(1);
    
    // User should not be able to insert for another account
    const { data: insertOtherData, error: insertOtherError } = await clientUser1
      .from('alerts')
      .insert({
        stripe_account_id: stripeAccount2,
        type: 'balance_low',
        status: 'pending',
        details: { message: 'Test other insert' }
      });
    
    expect(insertOtherError).not.toBeNull();
    expect(insertOtherData).toBeNull();

    // Clean up test data
    if (insertOwnData && insertOwnData.length > 0) {
      await supabaseAdmin.from('alerts').delete().eq('id', insertOwnData[0].id);
    }
  });
}); 