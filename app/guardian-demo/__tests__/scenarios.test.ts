import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Scenario } from '../types';

describe('Fraud scenarios', () => {
  it('velocity-breach scenario matches snapshot', () => {
    const scenarioPath = path.join(process.cwd(), 'public', 'guardian-demo', 'scenarios', 'velocity-breach.json');
    const scenarioContent = fs.readFileSync(scenarioPath, 'utf-8');
    const scenario = JSON.parse(scenarioContent) as Scenario;
    
    // Basic validation
    expect(Array.isArray(scenario)).toBe(true);
    expect(scenario.length).toBeGreaterThan(5);
    
    // Check that all events have the required fields
    scenario.forEach(event => {
      expect(event.delayMs).toBeTypeOf('number');
      expect(event.type).toBeTypeOf('string');
      expect(event.payload).toBeTypeOf('object');
      expect(event.payload.id).toBeTypeOf('string');
      expect(event.payload.object).toBeTypeOf('string');
    });
    
    // Check for specific sequence patterns
    const payoutEvents = scenario.filter(e => e.type.startsWith('payout.'));
    expect(payoutEvents.length).toBeGreaterThan(3);
    
    // Check for flagged status on at least one event
    const flaggedEvents = scenario.filter(e => e.payload.flagged === true || 
      (e.payload.metadata && e.payload.metadata.guardian_action === 'paused'));
    expect(flaggedEvents.length).toBeGreaterThan(0);
    
    // Ensure ordered delayMs values
    let lastDelay = -1;
    scenario.forEach(event => {
      expect(event.delayMs).toBeGreaterThanOrEqual(lastDelay);
      lastDelay = event.delayMs;
    });
    
    // Snapshot test
    expect(scenario).toMatchSnapshot();
  });
}); 