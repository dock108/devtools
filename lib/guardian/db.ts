import { Alert as AlertModel } from '@/lib/guardian/alerts';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PayoutEvent } from '@/types/supabase';

/**
 * Save an alert to the database
 */
export async function saveAlert(alert: AlertModel, event?: PayoutEvent) {
  try {
    const { data, error } = await supabaseAdmin.from('alerts').insert({
      alert_type: alert.type,
      severity: alert.severity,
      message: getAlertMessage(alert),
      stripe_payout_id: alert.payoutId || null,
      stripe_account_id: alert.accountId || null,
      event_id: event?.id || null,
      resolved: false
    }).select().single();
    
    if (error) {
      console.error('Failed to save alert to database:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error saving alert:', err);
    return null;
  }
}

/**
 * Get recent events for an account
 */
export async function getRecentEvents(accountId: string, limit = 20): Promise<PayoutEvent[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('payout_events')
      .select('*')
      .eq('stripe_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Failed to fetch recent events:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching events:', err);
    return [];
  }
}

/**
 * Generate a human-readable message for an alert
 */
function getAlertMessage(alert: AlertModel): string {
  switch (alert.type) {
    case 'VELOCITY':
      return `Velocity breach detected: ${alert.metadata?.breachCount || 'Multiple'} payouts in a short time window.`;
    
    case 'BANK_SWAP':
      return 'Bank account change detected for this account.';
    
    case 'GEO_MISMATCH':
      const country = alert.metadata?.country || 'unknown location';
      return `Unusual location detected: Activity from ${country}.`;
    
    default:
      return 'Suspicious activity detected.';
  }
} 