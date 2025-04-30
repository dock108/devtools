---
title: Frequently Asked Questions
description: Common questions and answers about Stripe Guardian's features, configuration, and best practices.
lastUpdated: 2025-05-02
---

# Frequently Asked Questions

Find answers to common questions about using Stripe Guardian to protect your Stripe Connect platform.

## General Questions

### What is Stripe Guardian?

Stripe Guardian is a fraud detection system designed specifically for Stripe Connect platforms. It monitors your connected accounts for suspicious payout behavior and other fraud indicators, generating alerts when it detects potential issues.

### How is Guardian different from Stripe Radar?

Stripe Radar focuses primarily on incoming payment fraud (e.g., detecting fraudulent cards at checkout). Guardian complements Radar by focusing on payout fraud and suspicious platform account behavior, which Radar typically doesn't cover.

### Which Stripe account types does Guardian support?

Guardian works with all Stripe Connect account types:

- Standard accounts
- Express accounts
- Custom accounts

## Setup & Configuration

### How do I connect my Stripe account to Guardian?

Follow these steps:

1. Sign in to your Guardian account
2. Navigate to Settings > Stripe Connection
3. Click "Connect with Stripe"
4. Complete the OAuth flow to grant Guardian the necessary permissions

<Alert type="info">
  Guardian requires specific OAuth scopes to function properly. These are pre-selected during the
  connection flow.
</Alert>

### What permissions does Guardian need?

Guardian requires the following Stripe permissions:

- Read access to accounts, payouts, and balance transactions
- Read access to events and webhooks
- Read access to capabilities and external accounts

### How long does it take to set up?

Most customers can set up Guardian in less than 30 minutes. After connecting your Stripe account, Guardian automatically begins monitoring new events. Historical data backfill (last 90 days) typically completes within a few hours.

## Alerts & Notifications

### How quickly are alerts generated?

Guardian processes Stripe events in near real-time. Alerts are typically generated within 1-2 minutes of the suspicious activity occurring in your Stripe account.

### Can I customize which alerts I receive?

Yes, Guardian allows you to:

- Configure which alert types are active
- Adjust risk thresholds for each alert type
- Customize notification settings by alert type and risk score

### How can I reduce false positives?

To reduce false positives:

1. Customize rule thresholds to match your platform's normal patterns
2. Create custom rule sets for different merchant categories
3. Provide feedback on alerts to help Guardian learn
4. Consider adjusting minimum amount thresholds for payout-related alerts

### What should I do when I receive an alert?

When you receive an alert:

1. Review the alert details to understand the potential issue
2. Check the affected Stripe account in the Stripe Dashboard
3. Take appropriate action based on your platform's policies
4. Mark the alert as resolved with accurate feedback

## Technical Questions

### How does Guardian access my Stripe data?

Guardian uses Stripe's OAuth and webhook systems to access your data:

- OAuth provides secure, permissioned API access
- Webhooks deliver real-time event notifications
- All data is transmitted securely using TLS

### Where is my data stored?

Guardian stores minimal metadata about your Stripe accounts and events. This data is encrypted at rest and stored in compliance with industry security standards.

### Can Guardian automatically pause payouts?

No, Guardian is designed as a monitoring and alerting system only. It doesn't make automated changes to your Stripe accounts. You maintain full control over when to pause payouts or take other actions.

### Does Guardian impact my Stripe API rate limits?

Guardian is designed to work efficiently within Stripe's rate limits. It uses webhooks for real-time events and batches historical data requests to minimize API usage.

## Account Management

### How do I add team members to Guardian?

To add team members:

1. Navigate to Settings > Team
2. Click "Invite Team Member"
3. Enter their email address and select appropriate permissions
4. The user will receive an email invitation to join

### Can I set different permissions for team members?

Yes, Guardian supports role-based access control. You can assign different roles to team members:

- Admin: Full access to all features and settings
- Analyst: Can view alerts and provide feedback, but cannot modify settings
- Viewer: Read-only access to alerts and dashboards

### How do I get help if I have more questions?

If you have additional questions:

- Check the detailed documentation pages
- Visit our [contact page](/contact) or email support@dock108.ai
- Join our community forum for peer discussions

## Pricing & Billing

### How is Guardian priced?

Guardian pricing is based on the number of connected Stripe accounts you monitor. Please contact our sales team for detailed pricing information.

### Is there a free trial?

Yes, Guardian offers a 14-day free trial with full access to all features. No credit card is required to start a trial.

### Can I cancel my subscription?

You can cancel your subscription at any time. Your access will continue until the end of your current billing period.

## Next Steps

- [Learn how to get started with Guardian](/docs)
- [Understand how alerts work](/docs/alerts)
- [Configure notification preferences](/docs/notifications)
