import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Tests to verify that alert_channels RLS policies work as expected.
 * 
 * These tests will use JWT tokens to simulate different user contexts.
 * Each test will ensure that a user can only access their own alert channels.
 */

describe('Alert Channels RLS Policies', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Admin client with service role
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Test account IDs
  const accountA = 'acct_test_a';
  const accountB = 'acct_test_b';

  // Setup test data
  beforeAll(async () => {
    // Clean up any existing test accounts
    await adminClient
      .from('alert_channels')
      .delete()
      .in('account_id', [accountA, accountB]);

    // Create test accounts
    await adminClient
      .from('alert_channels')
      .insert([
        { 
          account_id: accountA, 
          slack_webhook_url: 'https://hooks.slack.com/test/A',
          email_to: 'test-a@example.com',
          auto_pause: true
        },
        { 
          account_id: accountB,
          slack_webhook_url: 'https://hooks.slack.com/test/B',
          email_to: 'test-b@example.com',
          auto_pause: false
        }
      ]);
  });

  // Clean up test data
  afterAll(async () => {
    await adminClient
      .from('alert_channels')
      .delete()
      .in('account_id', [accountA, accountB]);
  });

  it('should allow an account owner to read their own alert channels', async () => {
    // Create client with JWT context for account A
    const clientA = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${generateJWT(accountA)}`
        }
      }
    });

    const { data, error } = await clientA
      .from('alert_channels')
      .select('*')
      .eq('account_id', accountA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].account_id).toBe(accountA);
  });

  it('should not allow an account owner to read other alert channels', async () => {
    // Create client with JWT context for account A
    const clientA = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${generateJWT(accountA)}`
        }
      }
    });

    const { data, error } = await clientA
      .from('alert_channels')
      .select('*')
      .eq('account_id', accountB);

    expect(data).toHaveLength(0);
  });

  it('should allow an account owner to update their own alert channels', async () => {
    // Create client with JWT context for account B
    const clientB = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${generateJWT(accountB)}`
        }
      }
    });

    const { error } = await clientB
      .from('alert_channels')
      .update({ auto_pause: true })
      .eq('account_id', accountB);

    expect(error).toBeNull();

    // Verify update
    const { data } = await adminClient
      .from('alert_channels')
      .select('auto_pause')
      .eq('account_id', accountB);

    expect(data![0].auto_pause).toBe(true);
  });

  it('should not allow an account owner to update other alert channels', async () => {
    // Create client with JWT context for account A
    const clientA = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${generateJWT(accountA)}`
        }
      }
    });

    const { error } = await clientA
      .from('alert_channels')
      .update({ auto_pause: false })
      .eq('account_id', accountB);

    expect(error).not.toBeNull();

    // Verify no change
    const { data } = await adminClient
      .from('alert_channels')
      .select('auto_pause')
      .eq('account_id', accountB);

    expect(data![0].auto_pause).toBe(true);
  });
});

/**
 * Helper to generate a mock JWT with the account_id claim
 */
function generateJWT(accountId: string): string {
  // In a real test you'd have proper JWT generation
  // For this example, we'll return a dummy token
  // that would be intercepted by test middleware
  return `dummy_token_for_${accountId}`;
} 