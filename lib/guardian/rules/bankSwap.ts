import type { RuleFn, Alert } from '../types';

export const bankSwap: RuleFn = async (event, ctx) => {
  const alerts: Alert[] = [];
  
  // Apply to account.updated with external_accounts or external_account.created events
  if (
    !(event.type === 'account.updated' && 
      event.data.previous_attributes?.external_accounts) && 
    !(event.type === 'external_account.created')
  ) {
    return alerts;
  }
  
  const accountId = event.account as string;
  
  // Get the external account ID
  let externalAccountId = 'unknown';
  if (event.type === 'external_account.created') {
    externalAccountId = (event.data.object as any).id || '';
  } else if (
    event.data.previous_attributes?.external_accounts?.data?.[0]?.id
  ) {
    externalAccountId = event.data.previous_attributes.external_accounts.data[0].id;
  }
  
  // Check for any high-value payouts within lookback window
  const { lookbackMinutes, minPayoutUsd } = ctx.config.bankSwap;
  const now = new Date().getTime();
  const lookbackMs = lookbackMinutes * 60 * 1000;
  const cutoff = now - lookbackMs;
  
  const recentPayouts = ctx.recentPayouts.filter(p => 
    new Date(p.created_at).getTime() >= cutoff && 
    (p.amount / 100) >= minPayoutUsd // Convert cents to dollars
  );
  
  // Always flag bank account changes
  alerts.push({
    type: 'BANK_SWAP',
    severity: recentPayouts.length > 0 ? 'high' : 'medium',
    message: `Bank account changed${recentPayouts.length > 0 ? ' after recent high-value payouts' : ''}`,
    accountId,
    chargeId: externalAccountId, // Using chargeId to store external account ID
    createdAt: new Date().toISOString()
  });
  
  return alerts;
}; 