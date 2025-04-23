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
  email: 'user-a@example.com',
  password: 'password123'
};

const MOCK_USER_B = {
  id: uuidv4(),
  email: 'user-b@example.com',
  password: 'password123'
};

// Test data
const TEST_ACCOUNT = {
  stripe_account_id: `acct_test_${Date.now()}`,
  user_id: MOCK_USER_A.id,
  business_name: 'Test Business A',
  status: 'active',
  webhook_secret: 'whsec_test123',
  live: false,
  metadata: { test: true }
};

describe('Connected Accounts RLS Policies', () => {
  // Client for User A
  let userAClient: any;
  // Client for User B
  let userBClient: any;

  beforeAll(async () => {
    // Create test users using admin client
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

    // Insert test account using admin client (bypassing RLS)
    await adminClient
      .from('connected_accounts')
      .upsert(TEST_ACCOUNT);
  });

  afterAll(async () => {
    // Clean up
    await adminClient
      .from('connected_accounts')
      .delete()
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id);

    await adminClient.auth.admin.deleteUser(MOCK_USER_A.id);
    await adminClient.auth.admin.deleteUser(MOCK_USER_B.id);
  });

  it('allows User A to read their own account', async () => {
    const { data, error } = await userAClient
      .from('connected_accounts')
      .select('*')
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.stripe_account_id).toEqual(TEST_ACCOUNT.stripe_account_id);
  });

  it('prevents User B from reading User A\'s account', async () => {
    const { data, error } = await userBClient
      .from('connected_accounts')
      .select('*')
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id)
      .single();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('allows User A to update their own account', async () => {
    const updatedBusinessName = 'Updated Business Name';
    
    const { error } = await userAClient
      .from('connected_accounts')
      .update({ business_name: updatedBusinessName })
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id);

    expect(error).toBeNull();

    // Verify the update was successful
    const { data } = await adminClient
      .from('connected_accounts')
      .select('business_name')
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id)
      .single();

    expect(data.business_name).toEqual(updatedBusinessName);
  });

  it('prevents User B from updating User A\'s account', async () => {
    const { error } = await userBClient
      .from('connected_accounts')
      .update({ business_name: 'Hacked Business Name' })
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id);

    expect(error).not.toBeNull();

    // Verify no change occurred
    const { data } = await adminClient
      .from('connected_accounts')
      .select('business_name')
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id)
      .single();

    expect(data.business_name).not.toEqual('Hacked Business Name');
  });

  it('allows the service role to bypass RLS', async () => {
    const { data, error } = await adminClient
      .from('connected_accounts')
      .select('*')
      .eq('stripe_account_id', TEST_ACCOUNT.stripe_account_id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.stripe_account_id).toEqual(TEST_ACCOUNT.stripe_account_id);
  });
}); 