import { GuardianEventRow } from '@/types/supabase';

export type GuardianDecision =
  | { flagged: false }
  | { flagged: true; reason: 'velocity'; breachCount: number }
  | { flagged: true; reason: 'bank_swap' };

export function evaluateEvent(
  event: GuardianEventRow,
  history: GuardianEventRow[],
  opts: { velocityLimit?: number; windowSec?: number } = {}
): GuardianDecision {
  const { velocityLimit = 3, windowSec = 60 } = opts;

  // --- Bank-swap rule ---
  // Check if it's an account update and if the previous attributes included external_accounts
  // A simple check for existence implies a change for this basic rule.
  // A more robust check would compare specific account IDs if available.
  if (
    event.type === 'account.updated' &&
    event.raw?.data?.previous_attributes?.external_accounts
  ) {
    return { flagged: true, reason: 'bank_swap' };
  }

  // --- Velocity rule ---
  // Only apply to payout events
  if (event.type === 'payout.paid') {
    const now = new Date(event.event_time).getTime();
    const cutoff = now - windowSec * 1000;

    // Count the current event + recent history within the window
    const recentPayouts = history.filter(
      (e) =>
        e.type === 'payout.paid' &&
        e.account === event.account && // Ensure same account
        new Date(e.event_time).getTime() >= cutoff
    );

    const totalInWindow = recentPayouts.length + 1; // +1 for the current event

    if (totalInWindow > velocityLimit) {
      return { flagged: true, reason: 'velocity', breachCount: totalInWindow };
    }
  }

  // If no rules matched, return not flagged
  return { flagged: false };
} 