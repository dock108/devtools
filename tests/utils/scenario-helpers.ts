import fs from 'fs';
import path from 'path';
import { GuardianEventRow } from '@/types/supabase';

/**
 * Helper function to convert scenario event to GuardianEventRow format
 */
export function scenarioEventToGuardianEvent(scenarioEvent: any): GuardianEventRow {
  const payload = scenarioEvent.payload;
  
  // Get account ID either from direct account property or from ID if it's an account
  // Default to a common account ID for demo scenarios so events are linked together
  const accountId = 
    payload.account || 
    (payload.id.startsWith('acct_') ? payload.id : 'acct_1O4X2jBtYGWWCuMs');
  
  // Handle date creation safely
  const now = new Date().toISOString();
  const timestamp = payload.created ? 
    new Date(payload.created * 1000).toISOString() : 
    now;
  
  return {
    id: payload.id,
    type: scenarioEvent.type,
    account: accountId,
    amount: payload.amount || null,
    currency: payload.currency || 'usd',
    event_time: timestamp,
    raw: payload,
    flagged: !!payload.flagged,
    created_at: now
  };
}

/**
 * Load a scenario from filesystem
 */
export function loadScenario(scenarioName: string): any[] {
  const scenarioPath = path.join(
    process.cwd(),
    'app',
    'guardian-demo',
    'scenarios',
    `${scenarioName}.json`
  );
  
  try {
    const scenarioData = fs.readFileSync(scenarioPath, 'utf-8');
    return JSON.parse(scenarioData);
  } catch (error) {
    console.error(`Error loading scenario ${scenarioName}:`, error);
    return [];
  }
}

/**
 * Convert a scenario to GuardianEventRow format
 */
export function loadScenarioAsGuardianEvents(scenarioName: string): GuardianEventRow[] {
  const scenarioEvents = loadScenario(scenarioName);
  return scenarioEvents.map(scenarioEventToGuardianEvent);
} 