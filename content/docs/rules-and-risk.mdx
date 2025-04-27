---
title: Rules & Risk Scoring
description: Understanding how Guardian detects fraud patterns and calculates risk scores.
lastUpdated: 2025-05-02
---

# Rules & Risk Scoring

Guardian uses a system of rules to detect suspicious activities and assigns risk scores to help you prioritize your response. This guide explains how the rules work and how risk scores are calculated.

## How Guardian Rules Work

Guardian monitors Stripe events in real-time and evaluates them against a set of predefined rules. When an event or pattern of events matches a rule's criteria, an alert is generated.

<Alert type="info">
  Rules are designed to catch common fraud patterns observed across Stripe Connect platforms while
  minimizing false positives.
</Alert>

### Rule Structure

Each rule has the following components:

- **Trigger Conditions**: The specific event patterns that activate the rule
- **Risk Weight**: How heavily the rule contributes to the overall risk score
- **Thresholds**: Configurable limits that determine when an alert is triggered
- **Description**: Human-readable explanation of what the rule detects

## Core Detection Rules

Guardian includes the following core rules:

### Payout Velocity

Detects when an account requests an unusually high number of payouts in a short period.

- **Trigger**: Multiple payouts within a defined timeframe
- **Thresholds**: Configuration allows for customization of count and time period
- **Example**: 3+ payouts within a 24-hour period

### Bank Account Swap

Identifies cases where a connected account changes their bank account details shortly before requesting a large payout.

- **Trigger**: Bank account change followed by payout within a configurable window
- **Thresholds**: Time between change and payout, payout amount
- **Signal Boosters**: First-time payouts, new accounts, large amounts

### Geographic Mismatch

Detects when a connect account's IP location significantly differs from their bank country.

- **Trigger**: IP country code doesn't match bank account country code
- **Signal Boosters**: First payout, high amount, newly connected account

### Charge Failure Burst

Identifies accounts with an unusual pattern of failed charge attempts.

- **Trigger**: Multiple failed charges in a short time window
- **Thresholds**: Number of failures, time window, ratio to successful charges

### Capability Changes

Alerts when critical account capabilities are suddenly disabled, which may indicate Stripe detected a risk issue.

- **Trigger**: Change in capability status, especially for payouts
- **Signal Boosters**: Recent large payouts, new account

## Risk Scoring

Guardian assigns a risk score (0-100) to each alert to help you prioritize your response. Higher scores indicate a higher likelihood of fraudulent activity.

### Score Components

The risk score is calculated using:

1. **Base Rule Weight**: Each rule has a base contribution to the risk score
2. **Signal Boosters**: Contextual factors that can increase the score
3. **Account History**: Previous alerts and behaviors on the account
4. **Feedback Adjustment**: How similar past alerts were resolved

<Alert type="warning">
  Risk scores are meant to guide prioritization, not make automated decisions. Use them in
  combination with your own judgment and platform-specific context.
</Alert>

### Risk Score Ranges

| Risk Score | Suggested Action                          |
| ---------- | ----------------------------------------- |
| 80-100     | High Risk - Immediate review recommended  |
| 60-79      | Medium-High Risk - Review within 12 hours |
| 40-59      | Medium Risk - Review within 24 hours      |
| 20-39      | Low-Medium Risk - Review as time permits  |
| 0-19       | Low Risk - Informational only             |

## Rule Customization

Guardian allows you to customize rule thresholds to match your platform's specific needs.

### Rule Sets

Rule sets are collections of rule configurations that can be applied to accounts:

- **Default Rule Set**: Applied to all accounts unless overridden
- **Custom Rule Sets**: Can be created and assigned to specific accounts

### Configurable Parameters

For each rule, you can typically configure:

- **Thresholds**: When the rule triggers (e.g., number of payouts, time windows)
- **Minimum Amounts**: Monetary thresholds below which alerts won't trigger
- **Risk Weights**: How much each rule contributes to the risk score

<Alert type="info">
  Start with the default rule configuration and adjust based on your observed false positive rate
  and the specific risk profile of your platform.
</Alert>

## Next Steps

- [Learn about alert notifications](/docs/notifications)
- [Review the frequently asked questions](/docs/faq)
