// Shared constants, enums, and interfaces for Stripe Guardian

export enum AlertType {
  Velocity = 'velocity',
  BankSwap = 'bank_swap',
  GeoMismatch = 'geo_mismatch',
  FailedChargeBurst = 'failed_charge_burst',
  SuddenPayoutDisable = 'sudden_payout_disable',
  HighRiskReview = 'high_risk_review',
}

export enum Severity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

// Basic Guardian Alert structure
// Corresponds roughly to public.alerts table but may be adapted for specific use cases
export interface GuardianAlert {
  id: number | string; // DB uses bigint (number), some contexts might use UUID (string)
  stripe_account_id: string;
  alert_type: AlertType;
  severity: Severity;
  created_at: string; // ISO timestamp string
  message: string | null; // Message from DB
  event_id?: number | null; // Foreign key to event_buffer
  stripe_payout_id?: string | null;
  resolved: boolean;
  // Potentially add event details or other relevant context if needed later
  // text?: string; // Derived text representation? Included in G-23 prompt but seems redundant with message
}

// Interface for data used by rule evaluation functions
// Needs refinement based on actual rule inputs
export interface GuardianRuleInput {
  event: any; // TODO: Replace with specific Stripe.Event types or Zod validated types
  accountId: string;
  // Potentially add historical data or account context
  // recentPayouts?: PayoutEvent[];
  // accountDetails?: Stripe.Account;
}

// Interface for the output of a rule evaluation function
export interface GuardianRuleOutput {
  alertType: AlertType;
  severity: Severity;
  message: string;
  payoutId?: string;
  // Add any other relevant details the rule determines
}
