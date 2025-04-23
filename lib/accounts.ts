import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from './supabase-admin';
import { ConnectedAccount } from '@/types/supabase';
import { logger } from './logger';

/**
 * Get all connected accounts for a specific user
 * 
 * @param userId - The user's UUID
 * @returns Array of connected accounts or empty array if none found
 */
export async function getAccountsForUser(userId: string): Promise<ConnectedAccount[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      logger.error({ error, userId }, 'Failed to fetch connected accounts for user');
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error({ error, userId }, 'Exception fetching connected accounts');
    return [];
  }
}

/**
 * Get a specific connected account by Stripe account ID
 * 
 * @param stripeAccountId - The Stripe account ID
 * @returns The connected account or null if not found
 */
export async function getAccountByStripeId(stripeAccountId: string): Promise<ConnectedAccount | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('stripe_account_id', stripeAccountId)
      .single();
    
    if (error) {
      logger.error({ error, stripeAccountId }, 'Failed to fetch connected account');
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error({ error, stripeAccountId }, 'Exception fetching connected account');
    return null;
  }
} 