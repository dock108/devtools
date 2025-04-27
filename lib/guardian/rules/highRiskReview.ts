import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { RuleContext } from './index';
import { GuardianRuleOutput, AlertType, Severity } from '@/lib/guardian/constants';

/**
 * RULE: High Risk Review
 * Detects when Stripe opens a review for a charge due to internal risk rules.
 */
export const highRiskReview = async (
  event: Stripe.Event,
  ctx: RuleContext,
): Promise<GuardianRuleOutput[]> => {
  // Only run this rule for review.opened events
  if (event.type !== 'review.opened' || !event.account) {
    return [];
  }

  const accountId = event.account;
  const review = event.data.object as Stripe.Review;

  // Safely access config
  const enabled = ctx.config?.highRiskReview?.enabled ?? true; // Default to enabled
  if (!enabled) {
    return [];
  }

  // Check if the review reason indicates Stripe's risk engine flagged it
  // Common reasons might be 'rule', potentially others - check Stripe docs
  if (review.reason === 'rule') {
    logger.info(
      { accountId, reviewId: review.id, chargeId: review.charge },
      'High risk review detected',
    );

    let chargeId: string | undefined;
    if (typeof review.charge === 'string') {
      chargeId = review.charge;
    } else if (review.charge && typeof review.charge === 'object' && 'id' in review.charge) {
      chargeId = review.charge.id;
    }

    return [
      {
        alertType: AlertType.HighRiskReview,
        severity: Severity.High,
        message: `Stripe flagged a potentially high-risk transaction for review (Charge: ${chargeId ?? 'N/A'}).`,
        // payoutId: undefined,
        // Optionally include chargeId or other details if needed in the alert record
      },
    ];
  }

  return [];
};
