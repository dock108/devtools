#!/bin/bash
# scripts/build_fixtures.sh
# Regenerates the Stripe event fixture file used for E2E tests.

set -e # Exit immediately if a command exits with a non-zero status.

FIXTURE_FILE="test/fixtures/full_day.jsonl"

# Ensure the fixtures directory exists
mkdir -p test/fixtures

# Clear the existing file
> "$FIXTURE_FILE"

echo "Generating Stripe fixture file: $FIXTURE_FILE"

# Add events - adjust counts and types as needed for realistic testing
# Aim for ~50 events total, covering different alert types

# --- Simulate normal activity ---
stripe trigger --quiet payment_intent.succeeded --save-to "$FIXTURE_FILE"
stripe trigger --quiet charge.succeeded --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.paid --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.paid --save-to "$FIXTURE_FILE"
stripe trigger --quiet payment_intent.succeeded --save-to "$FIXTURE_FILE"

# --- Simulate potential fraud / issues ---

# Velocity Breach related
stripe trigger --quiet payout.created --override payout:amount=10000 --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.created --override payout:amount=5000 --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.created --override payout:amount=12000 --save-to "$FIXTURE_FILE"

# Bank Swap related
stripe trigger --quiet customer.created --save-to "$FIXTURE_FILE"
stripe trigger --quiet customer.updated --save-to "$FIXTURE_FILE"
stripe trigger --quiet external_account.created --override external_account:object=bank_account --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.created --override payout:amount=500000 --save-to "$FIXTURE_FILE" # Large payout after change

# Geo Mismatch related (Harder to simulate exact IPs, use relevant events)
stripe trigger --quiet charge.succeeded --override charge:source:country=DE --save-to "$FIXTURE_FILE" # Charge from different country
stripe trigger --quiet payout.created --override payout:destination:bank_account:country=US --save-to "$FIXTURE_FILE"

# Failed Charge Burst related
stripe trigger --quiet charge.failed --override charge:failure_code=card_declined --save-to "$FIXTURE_FILE"
stripe trigger --quiet charge.failed --override charge:failure_code=expired_card --save-to "$FIXTURE_FILE"
stripe trigger --quiet charge.failed --override charge:failure_code=incorrect_cvc --save-to "$FIXTURE_FILE"
stripe trigger --quiet charge.failed --override charge:failure_code=card_declined --save-to "$FIXTURE_FILE"

# Sudden Payout Disable related
stripe trigger --quiet account.updated --override account:payouts_enabled=false --save-to "$FIXTURE_FILE"

# High Risk Review related
stripe trigger --quiet review.opened --override review:reason=rule --save-to "$FIXTURE_FILE"
stripe trigger --quiet review.opened --override review:reason=manual --save-to "$FIXTURE_FILE"

# --- More normal activity ---
stripe trigger --quiet payout.paid --save-to "$FIXTURE_FILE"
stripe trigger --quiet charge.succeeded --save-to "$FIXTURE_FILE"
stripe trigger --quiet payment_intent.succeeded --save-to "$FIXTURE_FILE"
stripe trigger --quiet payment_intent.succeeded --save-to "$FIXTURE_FILE"
stripe trigger --quiet payout.paid --save-to "$FIXTURE_FILE"

# --- Add ~25 more varied events to reach ~50 ---
for i in {1..5}
do
  stripe trigger --quiet payment_intent.succeeded --save-to "$FIXTURE_FILE"
  stripe trigger --quiet charge.succeeded --save-to "$FIXTURE_FILE"
  stripe trigger --quiet payout.paid --save-to "$FIXTURE_FILE"
  stripe trigger --quiet customer.created --save-to "$FIXTURE_FILE"
  stripe trigger --quiet invoice.paid --save-to "$FIXTURE_FILE" # Add some non-critical events
done

EVENT_COUNT=$(wc -l < "$FIXTURE_FILE")
echo "Done. Generated $EVENT_COUNT events in $FIXTURE_FILE"

# Suggest running it
echo "You can now use this file for testing, e.g.:"
echo "stripe listen --forward-to http://localhost:3000/api/stripe/webhook --events-from-file $FIXTURE_FILE" 