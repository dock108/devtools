---
title: Guardian Fraud Rules
description: Detailed explanation of the fraud detection rules implemented in Stripe Guardian.
---

# Guardian Rules

Guardian is our fraud detection system that evaluates a series of rules against Stripe events.

## Supported Scenarios

### Velocity Breach

**Type**: `VELOCITY`  
**Severity**: High  
**Trigger**: 3+ payouts in 60 seconds for the same connected account.  
**Alert Text**: `🚨 {count} payouts inside {windowSeconds}s`

Velocity breach indicates a potential system exploitation or fraudulent payout behavior.

### Bank Account Swap

**Type**: `BANK_SWAP`  
**Severity**: High  
**Trigger**: Bank account changed within 5 minutes before a large payout (≥ $1,000).  
**Alert Text**: `Bank account swapped {lookbackMinutes} min before ${payoutUsd} payout`

Bank account swaps immediately before large payouts can indicate an account takeover.

### Geographic Mismatch

**Type**: `GEO_MISMATCH`  
**Severity**: Medium  
**Trigger**: 2+ charges from countries different than the bank account country.  
**Alert Text**: `Detected {count} charges from foreign IPs vs bank country {bankCountry}`

Geographic mismatches between charge location and bank location can indicate fraud.

### Failed Charge Burst

**Type**: `FAILED_CHARGE_BURST`  
**Severity**: High  
**Trigger**: 3+ failed charges or payment attempts in 5 minutes for the same account.  
**Alert Text**: `Spike in failed payments for {account} – {count} in the last 5 min.`

Multiple failed charge attempts in a short period often indicate card testing or fraudulent activity.

### Sudden Payout Disable

**Type**: `SUDDEN_PAYOUT_DISABLE`  
**Severity**: Medium  
**Trigger**: Account update where payouts_enabled changes from true to false.  
**Alert Text**: `Payouts disabled for {account}.`

When Stripe disables payouts for an account, it often indicates a compliance issue or risk factor.

### High Risk Review

**Type**: `HIGH_RISK_REVIEW`  
**Severity**: High  
**Trigger**: Review opened with reason="rule" (Stripe's high-risk flag).  
**Alert Text**: `Stripe flagged a high-risk charge on {account}.`

Stripe's internal rules have identified a transaction as high-risk, requiring immediate review.

## Configuration

Rules can be configured globally or per account. See the `rule_set` field in the `connected_accounts` table.

# Guardian Rules Engine

The Guardian Rules Engine is responsible for detecting potentially fraudulent activities in the Stripe payment ecosystem. It analyzes events and applies a set of predefined rules to determine if a payout or account update should be flagged for review.

## Rule Types

Guardian currently supports three types of fraud detection rules:

1. **Velocity Breach**: Detects when too many payouts occur within a short time window, which may indicate fraudulent activity.
2. **Bank Swap**: Identifies when a connected account changes its bank details, a common pattern in fraud.
3. **Geo Mismatch**: Flags payouts initiated from unusual geographical locations.

## Configuring Thresholds

The rules engine uses a JSON configuration file to set thresholds for each rule. This allows customization of the fraud detection sensitivity without changing the underlying code.

```json
{
  "velocityBreach": {
    "maxPayouts": 3, // Maximum number of payouts allowed
    "windowSeconds": 60 // Time window to check (in seconds)
  },
  "bankSwap": {
    "lookbackMinutes": 5, // How far back to check for bank account changes
    "minPayoutUsd": 1000 // Minimum payout amount to trigger the rule
  },
  "geoMismatch": {
    "mismatchChargeCount": 2 // Number of mismatched locations to trigger
  }
}
```

### Per-Account Overrides

Guardian supports customizing rule thresholds on a per-account basis. Each Stripe account can have its own rule set that overrides the default settings.

To customize rules for a specific account:

1. Navigate to **Settings > Connected Accounts**
2. Find the account you want to customize
3. Click the **Edit Thresholds** button
4. Modify the JSON configuration to adjust rule sensitivity
5. Save your changes

For example, to increase velocity breach detection sensitivity for a high-risk account:

```json
{
  "velocityBreach": {
    "maxPayouts": 2, // More strict than default (3)
    "windowSeconds": 30 // Shorter window than default (60)
  },
  "bankSwap": {
    "lookbackMinutes": 10, // Longer window than default (5)
    "minPayoutUsd": 500 // Lower threshold than default (1000)
  },
  "geoMismatch": {
    "mismatchChargeCount": 1 // More strict than default (2)
  }
}
```

![Account Rule Editor](../images/rule-editor-screenshot.png)

All rule set changes are validated against a schema to prevent invalid configurations. If an account's rule set is invalid for any reason, Guardian will automatically fall back to the default settings.

### Schema Validation

The configuration is validated against a JSON Schema to ensure all values are within acceptable ranges and required properties are present. This prevents misconfiguration that could lead to false positives or missed fraud cases.

## How Rules Run

The Guardian Rules Engine uses a modular architecture to evaluate incoming Stripe events:

1. The webhook endpoint receives a Stripe event
2. Event is stored in the database
3. `evaluateRules()` is called with the event
4. Context data is fetched once from the database:
   - Recent payouts for the account
   - Recent charges for the account
   - Configuration settings
5. Each rule module is executed in sequence:
   - Velocity Breach rule
   - Bank Swap rule
   - Geo Mismatch rule
6. Alerts from all rules are collected and returned
7. Alerts are stored in the database
8. (Future) Alerts are sent via Slack/email

This modular approach allows:

- Easy addition of new rules without changing the core engine
- Single database query for context data shared across rules
- Independent rule testing
- Improved error handling (one rule failing won't block others)

```
┌─────────────┐     ┌───────────────┐     ┌─────────────────┐
│ Stripe      │     │ Webhook       │     │ Database        │
│ Event       │────▶│ Handler       │────▶│ (Events Table)  │
└─────────────┘     └───────┬───────┘     └─────────────────┘
                           │
                           ▼
┌─────────────┐     ┌───────────────┐     ┌─────────────────┐
│ Alert       │     │ Rule Engine   │     │ Database        │
│ Actions     │◀────│ (evaluateRules)│◀────│ (Context Data)  │
└─────────────┘     └───────┬───────┘     └─────────────────┘
                           │
                           ▼
                    ┌───────────────┐
                    │ Rule Modules  │
                    ├───────────────┤
                    │ velocityBreach│
                    │ bankSwap      │
                    │ geoMismatch   │
                    └───────┬───────┘
                           │
                           ▼
┌─────────────┐     ┌───────────────┐
│ Notification│     │ Database      │
│ (Slack/Email)│◀────│ (Alerts Table)│
└─────────────┘     └───────────────┘
```

## Using the Rules Engine

The Guardian Rules Engine exposes two main functions:

- `evaluateEvent()`: Analyzes an event and returns a decision (flagged/not flagged with reason)
- `runRules()`: Evaluates an event and creates an Alert if the event is flagged

Here's a basic example of how to use the engine:

```typescript
import { evaluateEvent, runRules } from '@/lib/guardian/rules';
import { ruleConfig } from '@/lib/guardian/config';

// Custom configuration (optional)
const customConfig = {
  velocityLimit: 5, // Override default
  windowSec: 120, // Override default
};

// Evaluate a single event
const decision = evaluateEvent(event, eventHistory, customConfig);

// Or create an alert if flagged
const alert = runRules(event, eventHistory, customConfig);
```

## Customizing Rules per Merchant

The configuration system allows for future expansion to support merchant-specific rules. In a production environment, you could:

1. Store merchant-specific configurations in a database
2. Load the appropriate configuration based on merchant ID
3. Pass custom thresholds to the rules engine

This approach allows for flexible fraud detection without changing the underlying code.
