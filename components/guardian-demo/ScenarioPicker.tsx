'use client';

import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type ScenarioPickerProps = {
  scenarios: string[];          // ['velocity-breach', ...]
  scenarioLabels?: Record<string, string>; // Friendly labels for scenarios
  currentScenario: string;      // active key
  onChange: (name: string) => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  onRestart?: () => void;
};

const STORAGE_KEY = 'sg:scenario';

export function ScenarioPicker({
  scenarios,
  scenarioLabels = {},
  currentScenario,
  onChange,
  speed = 1,
  onSpeedChange,
  onRestart
}: ScenarioPickerProps) {
  // If no scenario is selected, default to the first one
  useEffect(() => {
    if (!currentScenario && scenarios.length > 0) {
      // Try to load from localStorage first
      const storedScenario = localStorage.getItem(STORAGE_KEY);
      if (storedScenario && scenarios.includes(storedScenario)) {
        onChange(storedScenario);
      } else {
        // Fall back to first scenario
        onChange(scenarios[0]);
      }
    }
  }, [currentScenario, onChange, scenarios]);

  // Handle selection change
  const handleScenarioChange = (value: string) => {
    onChange(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  // Generate friendly labels for scenarios
  const getScenarioLabel = (scenarioId: string) => {
    return scenarioLabels[scenarioId] || 
      scenarioId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="rounded-lg border border-[var(--accent-guardian)] p-4 bg-white shadow-sm">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Demo Controls</h3>
          {onRestart && (
            <button
              onClick={onRestart}
              className="inline-flex items-center rounded-md border border-[var(--accent-guardian)] px-3 py-1 text-sm hover:bg-[var(--accent-guardian)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label="Restart demo"
              title="Restart demo"
            >
              Restart
            </button>
          )}
        </div>
        
        <div className="flex flex-col space-y-2">
          <label htmlFor="scenario-select" className="text-sm text-gray-600">
            Fraud scenario:
          </label>
          <Select 
            value={currentScenario || (scenarios.length > 0 ? scenarios[0] : '')}
            onValueChange={handleScenarioChange}
          >
            <SelectTrigger id="scenario-select" className="w-full">
              <SelectValue placeholder="Select a scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario) => (
                <SelectItem key={scenario} value={scenario}>
                  {getScenarioLabel(scenario)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Speed toggle button */}
            {onSpeedChange && (
          <div className="flex justify-end">
            <Button 
              variant="secondary" 
              onClick={() => onSpeedChange(speed === 1 ? 2 : 1)}
              className="ml-auto"
              aria-pressed={speed === 2}
            >
              {speed === 1 ? '2× speed' : 'Normal speed'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 