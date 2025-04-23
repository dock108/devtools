import fs from 'fs';
import path from 'path';
import { Stripe } from 'stripe';

/**
 * Load all demo scenarios as a dictionary
 */
export function loadDemoScenarios(): Record<string, Stripe.Event[]> {
  const scenarioNames = ['velocity-breach', 'bank-swap', 'geo-mismatch'];
  const scenarios: Record<string, Stripe.Event[]> = {};

  for (const name of scenarioNames) {
    scenarios[name] = loadScenario(name);
  }

  return scenarios;
}

/**
 * Load a specific demo scenario
 */
export function loadScenario(scenarioName: string): Stripe.Event[] {
  const scenarioPath = path.join(
    process.cwd(),
    'app',
    'guardian-demo',
    'scenarios',
    `${scenarioName}.json`,
  );

  try {
    const scenarioData = fs.readFileSync(scenarioPath, 'utf-8');
    const events = JSON.parse(scenarioData);

    // Format events to match Stripe.Event structure
    return events.map((event: any) => ({
      id: event.id,
      type: event.type,
      account: 'acct_demo', // Use consistent account ID for demo
      created: event.created,
      data: {
        object: event.payload,
        previous_attributes: event.previous_attributes || undefined,
      },
      // Add other required fields with defaults
      object: 'event',
      api_version: '2020-08-27',
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
    }));
  } catch (error) {
    console.error(`Error loading scenario ${scenarioName}:`, error);
    return [];
  }
}
