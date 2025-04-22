// types/supabase.d.ts

// Database tables
export interface ConnectedAccount {
  id: string;
  stripe_account_id: string;
  business_name: string | null;
  status: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface PayoutEvent {
  id: number;
  stripe_event_id: string;
  stripe_payout_id: string;
  stripe_account_id: string;
  type: string;
  amount: number | null;
  currency: string | null;
  event_data: Record<string, any>;
  created_at: string;
}

export interface Alert {
  id: number;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  message: string | null;
  stripe_payout_id: string | null;
  stripe_account_id: string | null;
  event_id: number | null;
  resolved: boolean;
  created_at: string;
}

// Legacy type used by the rule engine and demo components
export interface GuardianEventRow {
  id: string;          // Event ID (e.g., evt_...)
  type: string;        // Stripe event type (e.g., 'payout.paid', 'account.updated')
  account: string | null; // Stripe Connect account ID (e.g., acct_...)
  amount: number | null; // Amount in cents (for payout events)
  currency: string | null;
  event_time: string;  // ISO 8601 timestamp string
  raw: Record<string, any> | null; // The raw Stripe event JSON
  flagged: boolean | null;
  created_at?: string; // Supabase internal timestamp
}

// Adapter to convert PayoutEvent to GuardianEventRow for backwards compatibility
export function payoutEventToGuardianEvent(event: PayoutEvent): GuardianEventRow {
  return {
    id: event.stripe_event_id,
    type: event.type,
    account: event.stripe_account_id,
    amount: event.amount,
    currency: event.currency,
    event_time: event.created_at,
    raw: event.event_data,
    flagged: false,
    created_at: event.created_at
  };
} 