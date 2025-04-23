import type { RuleFn, Alert } from '../types';

export const velocityBreach: RuleFn = async (event, ctx) => {
  const alerts: Alert[] = [];
  
  // Only apply to payout.paid events
  if (event.type !== 'payout.paid') {
    return alerts;
  }
  
  const accountId = event.account as string;
  const { maxPayouts, windowSeconds } = ctx.config.velocityBreach;
  
  // Count recent payouts for this account
  const now = new Date().getTime();
  const cutoff = now - (windowSeconds * 1000);
  
  const recentPayouts = ctx.recentPayouts.filter(p => 
    new Date(p.created_at).getTime() >= cutoff
  );
  
  // Include current payout in the count
  const totalInWindow = recentPayouts.length + 1;
  
  if (totalInWindow > maxPayouts) {
    const payoutId = (event.data.object as any).id || '';
    alerts.push({
      type: 'VELOCITY',
      severity: 'high',
      message: `Velocity breach detected: ${totalInWindow} payouts in ${windowSeconds} seconds`,
      payoutId,
      accountId,
      createdAt: new Date().toISOString()
    });
  }
  
  return alerts;
}; 