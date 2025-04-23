export type Alert = {
  type: 'VELOCITY' | 'BANK_SWAP' | 'GEO_MISMATCH';
  severity: 'low' | 'medium' | 'high';
  message: string;
  payoutId?: string;
  chargeId?: string;
  accountId: string;
  createdAt: string;
};

export type StripeEvent = import('stripe/webhook').Event;

export type RuleFn = (evt: StripeEvent, ctx: RuleContext) => Promise<Alert[]>;

export type RuleContext = {
  recentPayouts: any[];
  recentCharges: any[];
  config: import('./config').RuleSet;
}; 