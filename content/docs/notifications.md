---
title: Notifications
description: Configure alert notification channels to keep your team informed about potential fraud.
lastUpdated: 2025-05-02
---

# Notifications

Guardian can notify your team about fraud alerts through multiple channels. This guide explains how to configure and manage alert notifications.

## Notification Channels

Guardian supports the following notification channels:

- **Email**: Send detailed alert notifications to specific team members
- **Slack**: Post alerts to designated Slack channels
- **Microsoft Teams**: Send alerts to Teams channels
- **Webhooks**: Trigger custom workflows in your own systems

<Alert type="info">
  You can configure multiple notification channels to ensure your team never misses an important
  alert.
</Alert>

## Email Notifications

Email notifications provide detailed information about the alert, including:

- Alert type and risk score
- Affected account details
- Timestamp and event context
- Direct link to view the full alert

![Example of an email notification showing alert details](/images/docs/notification-email-example.png)

### Configuring Email Notifications

To set up email notifications:

1. Navigate to **Settings > Notifications > Email**
2. Add recipient email addresses
3. Select which alert types and risk levels should trigger emails
4. Optionally customize the notification template
5. Save your settings

<Alert type="warning">
  Ensure notification emails are delivered to a monitored inbox. Consider setting up a dedicated
  email address like <code>fraud-alerts@yourdomain.com</code> to distribute to on-call staff.
</Alert>

## Slack Integration

Slack notifications allow your team to quickly triage alerts from your existing workspace.

### Slack Setup Process

1. Navigate to **Settings > Notifications > Slack**
2. Click "Connect to Slack"
3. Authorize Guardian to access your Slack workspace
4. Select the channel where alerts should be posted
5. Configure alert types and risk thresholds
6. Save your settings

### Slack Notification Features

Slack notifications include:

- Formatted alert card with severity coloring
- Basic alert details and risk score
- Quick action buttons for common responses
- Expandable details for more context

## Microsoft Teams Integration

Similar to Slack, Microsoft Teams integration allows alerts to be posted directly to your teams channels.

1. Navigate to **Settings > Notifications > Teams**
2. Follow the Microsoft authentication flow
3. Select the team and channel for notifications
4. Configure alert types and risk thresholds
5. Save your settings

## Webhook Notifications

For advanced use cases, Guardian can send alert data to your own systems via webhooks.

### Webhook Configuration

1. Navigate to **Settings > Notifications > Webhooks**
2. Enter your webhook URL
3. Configure alert types and risk thresholds
4. Save your settings

### Webhook Payload

Webhook notifications include a JSON payload with:

- Alert ID and type
- Risk score and severity
- Timestamp and affected account
- Context data specific to the alert type

## Notification Settings

### Global vs. Per-Account Settings

Notification settings can be configured:

- **Globally**: Apply to all accounts
- **Per-Account**: Override global settings for specific accounts

### Alert Filtering

You can filter which alerts trigger notifications based on:

- **Alert Type**: Only notify for specific fraud patterns
- **Risk Score**: Set minimum threshold (e.g., only notify for scores above 70)
- **Account ID**: Configure notification rules for specific accounts

### Notification Schedule

For each channel, you can configure:

- **Hours of Operation**: When notifications should be sent
- **Throttling**: Limits to prevent notification floods
- **Escalation**: Automatic escalation for high-risk alerts or unread alerts

<Alert type="info">
  For critical alerts (risk score 80+), consider configuring notifications that bypass normal
  filtering and scheduling rules.
</Alert>

## Best Practices

Follow these guidelines to optimize your notification setup:

1. **Layer notifications**: Use multiple channels for high-risk alerts
2. **Assign owners**: Ensure each notification channel has clear ownership
3. **Test regularly**: Verify notifications are working before you need them
4. **Avoid alert fatigue**: Start with stricter thresholds and adjust based on volume
5. **Include context**: Customize templates to include just enough information for triage

## Notification Status

You can verify notification delivery status from the alert detail page. Each alert shows:

- Which channels were notified
- When notifications were sent
- Delivery status for each channel

## Next Steps

- [Review frequently asked questions](/docs/faq)
- [Learn about alerts and how they work](/docs/alerts)
