import { createClient } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/postgrest-js';
import { Database } from '@/types/supabase';

/**
 * Runtime guard to ensure that a user only accesses their own resources.
 * This serves as a programmatic double-check even when RLS is enforced in the database.
 */
export async function validateResourceOwnership(
  stripeAccountId: string,
  userId: string
): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  // Using service role to bypass RLS for this check only
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('connected_accounts')
    .select('stripe_account_id')
    .eq('stripe_account_id', stripeAccountId)
    .eq('user_id', userId)
    .single();

  if (error) {
    // Log the error for debugging but return false to deny access
    console.error('Error validating ownership:', error);
    return false;
  }

  return !!data;
}

/**
 * Guard type that throws an exception if a user tries to access a resource they don't own.
 * Use this in any server-side context where extra protection is needed.
 */
export async function enforceResourceOwnership(
  stripeAccountId: string,
  userId: string
): Promise<void> {
  const isOwner = await validateResourceOwnership(stripeAccountId, userId);
  
  if (!isOwner) {
    throw new Error('Access denied: You do not have permission to access this resource');
  }
}

/**
 * Creates a filtered query that ensures a user can only access their own data,
 * even when using a service role that bypasses RLS.
 * 
 * @param supabase - Supabase client (typically service role client)
 * @param table - The table to query
 * @param userId - The authenticated user's ID
 * @returns A query builder with the ownership filter applied
 */
export function createOwnershipFilteredQuery<T extends keyof Database['public']['Tables']>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: T,
  userId: string
) {
  // For tables that have direct user_id column (like connected_accounts)
  if (table === 'connected_accounts') {
    return supabase
      .from(table)
      .select()
      .eq('user_id', userId);
  }
  
  // For tables that link to connected_accounts via stripe_account_id
  // Like payout_events, alerts, etc.
  return supabase
    .from(table)
    .select(`*, connected_accounts!inner(user_id)`)
    .eq('connected_accounts.user_id', userId);
}

/**
 * Type to ensure you're only using tables that support the ownership filter
 */
export type FilterableTables = 
  | 'connected_accounts'
  | 'payout_events'
  | 'alerts'; 