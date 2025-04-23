import type { RuleFn, Alert } from '../types';

export const geoMismatch: RuleFn = async (event, ctx) => {
  const alerts: Alert[] = [];
  
  // Only apply to payout-related events
  if (!['payout.paid', 'payout.created', 'payout.updated'].includes(event.type)) {
    return alerts;
  }
  
  const accountId = event.account as string;
  const metadata = (event.data.object as any)?.metadata || {};
  
  // Check for risk indicators in metadata
  const riskFactors = (metadata.risk_factors as string | undefined)?.split(',') || [];
  const hasGeoMismatch = riskFactors.includes('unusual_location') || 
                         riskFactors.includes('geo_mismatch') || 
                         metadata.guardian_reason === 'geo_mismatch';
  
  if (hasGeoMismatch) {
    const payoutId = (event.data.object as any).id || '';
    const { mismatchChargeCount } = ctx.config.geoMismatch;
    
    // Count charges with geo mismatches for this account
    const geoMismatchCharges = ctx.recentCharges.filter(c => {
      const chargeMeta = c.event_data?.metadata || {};
      const chargeRiskFactors = (chargeMeta.risk_factors as string | undefined)?.split(',') || [];
      return chargeRiskFactors.includes('unusual_location') || 
             chargeRiskFactors.includes('geo_mismatch');
    });
    
    // Increase severity if this is a pattern
    const severity = geoMismatchCharges.length >= mismatchChargeCount ? 'high' : 'medium';
    
    alerts.push({
      type: 'GEO_MISMATCH',
      severity,
      message: `Payout initiated from unusual location${geoMismatchCharges.length > 0 ? ' (repeated pattern)' : ''}`,
      payoutId,
      accountId,
      createdAt: new Date().toISOString()
    });
  }
  
  return alerts;
}; 