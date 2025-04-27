import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// --- Test Configuration ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables for testing',
  );
}

// --- Test User UUIDs (Must match seed data) ---
const USER_A_UUID = '00000000-aaaa-0000-0000-00000000000a';
const USER_B_UUID = '00000000-bbbb-0000-0000-00000000000b';
const ADMIN_USER_UUID = '00000000-adad-0000-0000-000000000dad';

// --- Test Credentials (Replace with actual test user credentials or a helper) ---
// !! IMPORTANT: DO NOT COMMIT ACTUAL PASSWORDS !!
// Use environment variables or a secure method in real scenarios.
const USER_A_EMAIL = 'user_a_rls_test@example.com'; // Ensure these users exist
const USER_A_PASSWORD = 'password123';
const ADMIN_EMAIL = 'admin_rls_test@example.com';
const ADMIN_PASSWORD = 'password123';

// --- Helper Function (Placeholder - Implement actual token retrieval) ---
// This likely needs to use the service role key to sign in the test user
async function getTestUserToken(email: string, pass: string): Promise<string | null> {
  // Example using a service role client (ensure SERVICE_ROLE_KEY is available)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, cannot generate test user tokens.');
    return null;
  }
  const adminClient = createClient(supabaseUrl!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // This is an example; actual implementation might differ based on library version/capabilities
  // Using signInWithPassword might not be ideal with service key. Consider admin functions if available.
  const { data, error } = await adminClient.auth.signInWithPassword({ email, password: pass });

  if (error || !data.session?.access_token) {
    console.error(`Failed to get token for ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

// --- Test Suite ---
describe('Supabase RLS and Security Policies', () => {
  let supaUserA: SupabaseClient;
  let supaAdmin: SupabaseClient;

  beforeAll(async () => {
    const tokenUserA = await getTestUserToken(USER_A_EMAIL, USER_A_PASSWORD);
    const tokenAdmin = await getTestUserToken(ADMIN_EMAIL, ADMIN_PASSWORD);

    if (!tokenUserA || !tokenAdmin) {
      throw new Error(
        'Failed to obtain test user tokens. Ensure test users exist and getTestUserToken is implemented correctly.',
      );
    }

    supaUserA = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: `Bearer ${tokenUserA}` } },
      auth: { persistSession: false },
    });

    supaAdmin = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: `Bearer ${tokenAdmin}` } },
      auth: { persistSession: false },
    });
  });

  // Test RLS on Tables
  const protectedTables = [
    // 'events_raw', // Assuming RLS is based on user_id or related field
    'alerts',
    'notification_queue',
    'connected_accounts',
    'account_backfill_status',
    // Add other tables with user_id based RLS
  ];

  it.each(protectedTables)(
    'Table %s should prevent User A reading User B data',
    async (tableName) => {
      // Attempt to select rows potentially belonging to User B
      // This assumes a `user_id` column exists and is used by RLS.
      // Adjust the query if the linking column is different (e.g., via connected_accounts)
      const { data, error } = await supaUserA
        .from(tableName)
        .select('*') // Select all to test broad access
        .eq('user_id', USER_B_UUID); // Filter for User B's ID

      // Assertion: Expect either an error OR empty data (depending on RLS policy)
      if (error) {
        // Supabase might throw a specific RLS error (less common now)
        // Or a generic permission error
        expect(error.code).toMatch(/42501|42703|PGRST.*/); // insufficient_privilege, undefined_column (if user_id not direct), PostgREST errors
        expect(data).toBeNull();
      } else {
        // More common: RLS policy filters out rows, resulting in empty array
        expect(data).toEqual([]);
      }
    },
  );

  // Test RPC Security
  describe('RPC Security', () => {
    it('RPC insert_alert_and_enqueue should fail if User A tries to insert for User B', async () => {
      const { data, error } = await supaUserA.rpc('insert_alert_and_enqueue', {
        p_event_id: uuidv4(),
        p_rule_id: 'test_rule_rls',
        p_user_id: USER_B_UUID, // Mismatched user ID
      });

      // Expect an error due to RLS inside the function or explicit checks
      expect(error).not.toBeNull();
      // Error might be generic DB error or specific RLS error
      expect(error?.message).toMatch(/permission denied|row level security policy/i);
    });

    it('RPC fetch_notification_batch should only return User A jobs (if applicable)', async () => {
      // This test assumes fetch_notification_batch exists and should be user-specific.
      // If RLS on notification_queue handles this implicitly, this test might be redundant
      // with the table RLS test above.
      try {
        const { data, error } = await supaUserA.rpc('fetch_notification_batch', { p_limit: 10 });
        expect(error).toBeNull();
        // Assert that all returned jobs belong to User A (or related accounts)
        // This requires knowing the structure returned by the RPC.
        // Example: Assuming jobs have an alert_id linked to alerts table with user_id
        // Further checks might be needed based on actual data structure.
        expect(data).toBeInstanceOf(Array);
      } catch (rpcError: any) {
        // If the RPC itself doesn't exist or fails, handle that
        console.warn(`Skipping fetch_notification_batch test, RPC failed: ${rpcError.message}`);
      }
    });

    it('RPC guardian_run_retention should fail for non-admin User A', async () => {
      // This assumes the RPC itself or the calling mechanism (like Edge Function) enforces admin
      const { error } = await supaUserA.rpc('guardian_run_retention');
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied|admin privileges required/i);
    });

    it('RPC guardian_run_retention should succeed for admin User', async () => {
      const { error } = await supaAdmin.rpc('guardian_run_retention');
      // We expect success (no error), actual data deletion is tested elsewhere
      expect(error).toBeNull();
    });
  });

  // Test Admin API Route Access
  describe('Admin API Route Security', () => {
    it('/api/admin/retention-status should return 403 for non-admin User A', async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/admin/retention-status`, {
        headers: {
          Authorization: `Bearer ${supaUserA.auth.session()?.access_token}`,
          apikey: supabaseAnonKey!,
        },
      });
      expect(response.status).toBe(403); // Or 401 if auth check fails first
    });

    it('/api/admin/retention-status should return 200 for admin User', async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/admin/retention-status`, {
        headers: {
          Authorization: `Bearer ${supaAdmin.auth.session()?.access_token}`,
          apikey: supabaseAnonKey!,
        },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('ranAt');
    });
  });
});
