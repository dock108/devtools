import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables for RLS tests');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

// Mock users for testing
const MOCK_USER_A = {
  id: uuidv4(),
  email: 'user-a-rls@example.com',
  password: 'password123'
};

const MOCK_USER_B = {
  id: uuidv4(),
  email: 'user-b-rls@example.com',
  password: 'password123'
};

// Test data
const TEST_ACCOUNT_A = {
  stripe_account_id: `acct_test_a_${Date.now()}`,
  user_id: MOCK_USER_A.id,
  business_name: 'Test Business A',
  status: 'active',
  webhook_secret: 'whsec_test123',
  live: false,
  metadata: { test: true }
};

const TEST_ACCOUNT_B = {
  stripe_account_id: `acct_test_b_${Date.now()}`,
  user_id: MOCK_USER_B.id,
  business_name: 'Test Business B',
  status: 'active',
  webhook_secret: 'whsec_test456',
  live: false,
  metadata: { test: true }
};

const TEST_PAYOUT_EVENT = {
  stripe_event_id: `evt_test_${Date.now()}`,
  stripe_payout_id: `po_test_${Date.now()}`,
  stripe_account_id: TEST_ACCOUNT_A.stripe_account_id,
  type: 'payout.created',
  amount: 10000,
  currency: 'usd',
  event_data: { object: { id: `po_test_${Date.now()}` } }
};

const TEST_ALERT = {
  alert_type: 'VELOCITY',
  severity: 'medium',
  message: 'Test alert for RLS',
  stripe_payout_id: TEST_PAYOUT_EVENT.stripe_payout_id,
  stripe_account_id: TEST_ACCOUNT_A.stripe_account_id,
  resolved: false
};

describe('Core Tables RLS Policies', () => {
  // Client for User A and B
  let userAClient: any;
  let userBClient: any;
  let alertId: number;

  beforeAll(async () => {
    // Create test users
    await adminClient.auth.admin.createUser({
      uuid: MOCK_USER_A.id,
      email: MOCK_USER_A.email,
      password: MOCK_USER_A.password,
      email_confirm: true
    });

    await adminClient.auth.admin.createUser({
      uuid: MOCK_USER_B.id,
      email: MOCK_USER_B.email,
      password: MOCK_USER_B.password,
      email_confirm: true
    });

    // Create connected accounts
    await adminClient
      .from('connected_accounts')
      .upsert([TEST_ACCOUNT_A, TEST_ACCOUNT_B]);

    // Insert test payout event for account A
    await adminClient
      .from('payout_events')
      .insert(TEST_PAYOUT_EVENT);

    // Insert test alert for account A
    const { data } = await adminClient
      .from('alerts')
      .insert(TEST_ALERT)
      .select();
    
    alertId = data?.[0]?.id;

    // Sign in as User A
    const userAResponse = await adminClient.auth.signInWithPassword({
      email: MOCK_USER_A.email,
      password: MOCK_USER_A.password
    });
    
    // Create client that assumes User A's identity
    userAClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${userAResponse.data.session!.access_token}`
        }
      }
    });

    // Sign in as User B
    const userBResponse = await adminClient.auth.signInWithPassword({
      email: MOCK_USER_B.email,
      password: MOCK_USER_B.password
    });
    
    // Create client that assumes User B's identity
    userBClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${userBResponse.data.session!.access_token}`
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up in reverse order due to foreign key constraints
    await adminClient
      .from('alerts')
      .delete()
      .eq('stripe_account_id', TEST_ACCOUNT_A.stripe_account_id);
    
    await adminClient
      .from('payout_events')
      .delete()
      .eq('stripe_event_id', TEST_PAYOUT_EVENT.stripe_event_id);
    
    await adminClient
      .from('connected_accounts')
      .delete()
      .in('stripe_account_id', [
        TEST_ACCOUNT_A.stripe_account_id,
        TEST_ACCOUNT_B.stripe_account_id
      ]);

    await adminClient.auth.admin.deleteUser(MOCK_USER_A.id);
    await adminClient.auth.admin.deleteUser(MOCK_USER_B.id);
  });

  describe('payout_events RLS', () => {
    it('allows User A to read own payout events', async () => {
      const { data, error } = await userAClient
        .from('payout_events')
        .select('*')
        .eq('stripe_event_id', TEST_PAYOUT_EVENT.stripe_event_id)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.stripe_event_id).toEqual(TEST_PAYOUT_EVENT.stripe_event_id);
    });

    it('prevents User B from reading User A\'s payout events', async () => {
      const { data, error } = await userBClient
        .from('payout_events')
        .select('*')
        .eq('stripe_event_id', TEST_PAYOUT_EVENT.stripe_event_id);

      expect(data).toHaveLength(0);
    });
  });

  describe('alerts RLS', () => {
    it('allows User A to read own alerts', async () => {
      const { data, error } = await userAClient
        .from('alerts')
        .select('*')
        .eq('stripe_account_id', TEST_ACCOUNT_A.stripe_account_id);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('prevents User B from reading User A\'s alerts', async () => {
      const { data, error } = await userBClient
        .from('alerts')
        .select('*')
        .eq('stripe_account_id', TEST_ACCOUNT_A.stripe_account_id);

      expect(data).toHaveLength(0);
    });

    it('allows User A to resolve own alerts', async () => {
      const { error } = await userAClient
        .from('alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      expect(error).toBeNull();

      // Verify update was successful
      const { data } = await adminClient
        .from('alerts')
        .select('resolved')
        .eq('id', alertId)
        .single();

      expect(data.resolved).toBe(true);
    });

    it('prevents User B from resolving User A\'s alerts', async () => {
      // First, reset the alert to unresolved
      await adminClient
        .from('alerts')
        .update({ resolved: false })
        .eq('id', alertId);

      // Now try to resolve as User B
      const { error } = await userBClient
        .from('alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      expect(error).not.toBeNull();

      // Verify update was not successful
      const { data } = await adminClient
        .from('alerts')
        .select('resolved')
        .eq('id', alertId)
        .single();

      expect(data.resolved).toBe(false);
    });
  });

  describe('pending_notifications RLS', () => {
    it('denies regular users from reading pending_notifications', async () => {
      const { data, error } = await userAClient
        .from('pending_notifications')
        .select('*');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('allows service role to read pending_notifications', async () => {
      const { data, error } = await adminClient
        .from('pending_notifications')
        .select('*');

      expect(error).toBeNull();
      // We don't care about the result, just that we can query
    });
  });
}); 