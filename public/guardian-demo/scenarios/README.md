# Stripe Guardian Demo Scenarios

This directory contains the JSON scenario files used by the Stripe Guardian demo. These scenarios are designed to showcase specific fraud patterns in a deterministic way.

## Available Scenarios

- `velocity-breach.json`: Demonstrates multiple payouts in a short time period, triggering velocity limits.
- `bank-swap.json`: Demonstrates a merchant changing bank accounts and immediately making a payout.
- `geo-mismatch.json`: Demonstrates a payout being initiated from an unexpected geographical location.

## Writing Your Own Scenario

Scenarios are JSON files structured as an array of event objects. Each event has the following schema:

```json
{
  "delayMs": 2000,        // Milliseconds to wait before emitting this event after the previous one
  "type": "payout.paid",  // Event type (must be "account.updated" or "payout.paid")
  "payload": {            // The Stripe-like event payload
    "id": "po_abc123",    // A unique ID for this event
    "object": "payout",   // The object type
    "amount": 5000,       // Amount in cents (for payout events)
    // ... other fields relevant to the event type
  }
}
```

### Example Scenario

Here's a simple example of a scenario file:

```json
[
  {
    "delayMs": 0,
    "type": "account.updated",
    "payload": {
      "id": "acct_123",
      "object": "account",
      "business_profile": {
        "name": "Example Merchant"
      }
    }
  },
  {
    "delayMs": 2000,
    "type": "payout.paid",
    "payload": {
      "id": "po_123",
      "object": "payout",
      "amount": 5000,
      "status": "paid"
    }
  }
]
```

### JSON Schema

The full JSON schema for scenarios is:

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "required": ["delayMs", "type", "payload"],
    "properties": {
      "delayMs": {
        "type": "number",
        "description": "Milliseconds to wait before emitting this event"
      },
      "type": {
        "type": "string",
        "enum": ["account.updated", "payout.paid"],
        "description": "The type of Stripe event"
      },
      "payload": {
        "type": "object",
        "required": ["id", "object"],
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for this event"
          },
          "object": {
            "type": "string",
            "description": "The type of object (account, payout, etc.)"
          },
          "amount": {
            "type": "number",
            "description": "For payout events, the amount in cents"
          }
        },
        "additionalProperties": true
      }
    }
  }
}
```

## Tips for Creating Effective Scenarios

1. Start with an `account.updated` event to establish context
2. Use realistic delays between events (typically 2-5 seconds)
3. For fraud patterns, build up to the fraudulent event gradually
4. Keep scenarios under 10 events for better demo experiences
5. Use descriptive ID fields to help track events
6. Include only necessary fields in the payload to keep scenarios readable

## Adding Your Scenario to the UI

To make your scenario available in the demo UI:

1. Add your JSON file to this directory with a descriptive name (e.g., `unusual-amount.json`)
2. Update the `availableScenarios` array in `components/guardian-demo/ScenarioPicker.tsx`
3. Add a human-readable label to the `scenarioLabels` object in the same file 