'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ScenarioPickerProps = {
  scenarios: string[];          // ['velocity-breach', ...]
  scenarioLabels?: Record<string, string>; // Friendly labels for scenarios
  currentScenario: string;      // active key
  onChange: (name: string) => void;
  onLoopToggle?: (enabled: boolean) => void;
  loopEnabled?: boolean;
  speedFactor?: number;
  onSpeedChange?: (speed: number) => void;
  currentIndex?: number;
  totalEvents?: number;
  onRestart?: () => void;
};

const STORAGE_KEY = 'sg:scenario';

export function ScenarioPicker({
  scenarios,
  scenarioLabels = {},
  currentScenario,
  onChange,
  loopEnabled,
  onLoopToggle,
  speedFactor = 1,
  onSpeedChange,
  currentIndex = 0,
  totalEvents = 0,
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
        
        {onLoopToggle && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="loop-toggle"
                checked={loopEnabled}
                onChange={(e) => onLoopToggle(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--accent-guardian)] focus:ring-[var(--accent-guardian)]"
              />
              <label htmlFor="loop-toggle" className="ml-2 text-sm text-gray-600">
                Loop Scenario
              </label>
            </div>
            
            {onSpeedChange && (
              <div className="flex items-center space-x-2">
                <label htmlFor="speed-select" className="text-sm text-gray-600">
                  Speed:
                </label>
                <select
                  id="speed-select"
                  value={speedFactor}
                  onChange={(e) => onSpeedChange(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-[var(--accent-guardian)] focus:ring-[var(--accent-guardian)]"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="4">4x</option>
                </select>
              </div>
            )}
          </div>
        )}
        
        {currentScenario && totalEvents > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress:</span>
              <span>{currentIndex} / {totalEvents}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-[var(--accent-guardian)] h-2.5 rounded-full"
                style={{ width: `${(currentIndex / totalEvents) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 