// types/supabase.d.ts
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