'use client';

export interface ScenarioInfo {
  id: string;
  label: string;
}

/**
 * Get a list of available scenarios
 * 
 * Note: We use a static list instead of reading from the filesystem
 * since this needs to work in the browser context
 */
export function getScenarios(): ScenarioInfo[] {
  // Static list of available scenarios
  return [
    { id: 'velocity-breach', label: 'Velocity Breach' },
    { id: 'bank-swap', label: 'Bank Account Swap' },
    { id: 'geo-mismatch', label: 'Geo-Location Mismatch' }
  ];
} 