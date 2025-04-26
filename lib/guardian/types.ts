export type Alert = {
  type:
    | 'VELOCITY'
    | 'BANK_SWAP'
    | 'GEO_MISMATCH'
    | 'FAILED_CHARGE_BURST'
    | 'SUDDEN_PAYOUT_DISABLE'
    | 'HIGH_RISK_REVIEW';
  severity: 'low' | 'medium' | 'high';
  message: string;
  payoutId?: string;
  chargeId?: string;
  accountId: string;
  createdAt: string;
};

export type AlertChannel = {
  account_id: string;
  slack_webhook_url?: string;
  email_to?: string;
  auto_pause: boolean;
  created_at: string;
};

export type StripeEvent = import('stripe/webhook').Event;

export type RuleFn = (evt: StripeEvent, ctx: RuleContext) => Promise<Alert[]>;

export type RuleContext = {
  recentPayouts: any[];
  recentCharges: any[];
  config: import('./config').RuleSet;
};
