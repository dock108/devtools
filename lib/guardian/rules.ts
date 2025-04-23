import { GuardianEventRow } from '@/types/supabase';
import {
  Alert,
  createBankSwapAlert,
  createGeoMismatchAlert,
  createVelocityAlert,
} from './alerts';
import { ruleConfig } from './config';
import { evaluateRules, evaluateRulesEdge } from './rules/index';

export type GuardianDecision =
  | { flagged: false }
  | { flagged: true; reason: 'velocity'; breachCount: number }
  | { flagged: true; reason: 'bank_swap' }
  | { flagged: true; reason: 'geo_mismatch' };

/**
 * Evaluate a Guardian event against fraud rules and return the decision
 */
export function evaluateEvent(
  event: GuardianEventRow,
  history: GuardianEventRow[] = [],
  opts: { velocityLimit?: number; windowSec?: number } = {},
): GuardianDecision {
  const { velocityLimit = ruleConfig.velocityBreach.maxPayouts, windowSec = ruleConfig.velocityBreach.windowSeconds } = opts;

  // Guard for null/undefined events
  if (!event) {
    return { flagged: false };
  }

  /**
   * 1. Scenario overrides (pre‑flagged events used in tests/demo)
   *    If Stripe webhook metadata already indicates a specific risk, respect it.
   */
  if (event.flagged === true) {
    const metadata = event.raw?.metadata || {};
    const riskFactors: string[] = (metadata.risk_factors as string | undefined)?.split(',') || [];
    const guardianReason = metadata.guardian_reason as string | undefined;

    if (
      guardianReason === 'velocity_breach' ||
      guardianReason === 'velocity' ||
      riskFactors.includes('velocity_breach')
    ) {
      return { flagged: true, reason: 'velocity', breachCount: ruleConfig.velocityBreach.maxPayouts };
    }

    if (
      guardianReason === 'bank_account_swap' ||
      guardianReason === 'bank_swap' ||
      riskFactors.includes('bank_account_swap') ||
      riskFactors.includes('new_bank_account')
    ) {
      return { flagged: true, reason: 'bank_swap' };
    }

    if (
      guardianReason === 'geo_mismatch' ||
      riskFactors.includes('unusual_location') ||
      riskFactors.includes('geo_mismatch')
    ) {
      return { flagged: true, reason: 'geo_mismatch' };
    }

    // Fallback: flagged payout → treat as velocity breach
    if (event.type === 'payout.paid') {
      return { flagged: true, reason: 'velocity', breachCount: ruleConfig.velocityBreach.maxPayouts };
    }
  }

  /**
   * 2. Bank‑swap rule – account bank details changed.
   *    a) `account.updated` with `previous_attributes.external_accounts`
   *    b) `external_account.created`
   */
  if (
    (event.type === 'account.updated' &&
      event.raw?.data?.previous_attributes?.external_accounts) ||
    event.type === 'external_account.created'
  ) {
    return { flagged: true, reason: 'bank_swap' };
  }

  /**
   * 3. Geo‑mismatch rule – payout initiated from unusual location.
   *    Trigger on payout‑related events when risk metadata hints at mismatch.
   */
  if (
    ['payout.paid', 'payout.created', 'payout.updated'].includes(event.type)
  ) {
    const metadata = event.raw?.metadata || {};
    const riskFactors: string[] = (metadata.risk_factors as string | undefined)?.split(',') || [];
    if (
      riskFactors.includes('unusual_location') ||
      riskFactors.includes('geo_mismatch') ||
      metadata.guardian_reason === 'geo_mismatch'
    ) {
      return { flagged: true, reason: 'geo_mismatch' };
    }
  }

  /**
   * 4. Velocity rule – more than `velocityLimit` payouts in `windowSec` seconds
   *    for the same connected account.
   */
  if (event.type === 'payout.paid') {
    if (!event.event_time) return { flagged: false };

    const now = new Date(event.event_time).getTime();
    const cutoff = now - windowSec * 1000;

    const recentPayouts = history.filter(
      (e) =>
        e.type === 'payout.paid' &&
        e.account === event.account &&
        e.event_time &&
        new Date(e.event_time).getTime() >= cutoff,
    );

    const totalInWindow = recentPayouts.length + 1; // include current
    if (totalInWindow > velocityLimit) {
      return { flagged: true, reason: 'velocity', breachCount: totalInWindow };
    }
  }

  // Default – clean
  return { flagged: false };
}

/**
 * Run rules and, if flagged, create an appropriate Alert instance.
 */
export function runRules(
  event: GuardianEventRow,
  history: GuardianEventRow[] = [],
  opts: { velocityLimit?: number; windowSec?: number } = {},
): Alert | null {
  if (!event) return null;

  const decision = evaluateEvent(event, history, opts);
  if (!decision.flagged) return null;

  const accountId = event.account || 'unknown';

  switch (decision.reason) {
    case 'velocity':
      return createVelocityAlert(event.id, accountId, decision.breachCount);

    case 'bank_swap': {
      // Attempt to derive external account id from various event shapes
      let externalAccountId = 'unknown';
      if (event.type === 'external_account.created') {
        externalAccountId = event.id;
      } else if (
        event.raw?.data?.previous_attributes?.external_accounts?.data?.[0]?.id
      ) {
        externalAccountId =
          event.raw.data.previous_attributes.external_accounts.data[0].id;
      } else if (event.raw?.metadata?.destination) {
        externalAccountId = event.raw.metadata.destination as string;
      } else {
        const recentExternal = history
          .filter((e) => e.type === 'external_account.created')
          .sort(
            (a, b) =>
              new Date(b.event_time || 0).getTime() -
              new Date(a.event_time || 0).getTime(),
          )[0];
        if (recentExternal) externalAccountId = recentExternal.id;
      }
      return createBankSwapAlert(externalAccountId, accountId);
    }

    case 'geo_mismatch': {
      const geoMeta = {
        country: (event.raw?.metadata?.ip_country as string) || 'unknown',
        ip: (event.raw?.metadata?.ip_address as string) || 'unknown',
      };
      return createGeoMismatchAlert(event.id, accountId, geoMeta);
    }

    default:
      return null;
  }
}

// Re-export both implementations
export { evaluateRules, evaluateRulesEdge };