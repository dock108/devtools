'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EventTable } from '../../components/guardian-demo/EventTable';
import type { DemoEvent } from './useFakeStripeEvents'; // Keep type definition if needed by EventTable
import type { ScenarioEvent } from './useDemoScenario'; // Type for raw scenario data

// Define available scenarios and their display names
const scenarios = {
  'velocity-breach': 'Medium traffic / Few fraud alerts', // Default
  'bank-swap': 'High traffic / Multiple fraud spikes',
  'geo-mismatch': 'Low traffic / Geo mismatch alert',
};
type ScenarioId = keyof typeof scenarios;

// Simulation settings
const simulationRates: Record<ScenarioId, number> = {
  'velocity-breach': 2000, // ms per event
  'bank-swap': 1500,
  'geo-mismatch': 3000,
};
const MIN_RUN_MS = 45_000;
const MAX_DISPLAYED_EVENTS = 50; // Limit displayed events for performance

export function DemoViewer() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('velocity-breach');
  const [displayedEvents, setDisplayedEvents] = useState<DemoEvent[]>([]);
  const [currentScenarioEvents, setCurrentScenarioEvents] = useState<ScenarioEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading on initial load/scenario fetch
  const [error, setError] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- 45-second Lock Timer --- //
  useEffect(() => {
    console.log('Starting 45s lock timer');
    const unlockTimer = setTimeout(() => {
      console.log('Unlocking scenario switching');
      setCanSwitch(true);
    }, MIN_RUN_MS);

    // Clear timer on unmount
    return () => {
      console.log('Clearing 45s lock timer');
      clearTimeout(unlockTimer);
    };
  }, []); // Run only once on mount

  // --- Clear Interval Utility --- //
  const clearSimulationInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('Cleared simulation interval');
    }
  }, []);

  // --- Fetch Scenario Data --- //
  useEffect(() => {
    async function loadScenarioData() {
      console.log(`Loading scenario: ${scenarioId}`);
      setIsLoading(true);
      setError(null);
      clearSimulationInterval(); // Stop previous simulation
      setDisplayedEvents([]); // Clear displayed events
      setCurrentIndex(0); // Reset index

      try {
        const response = await fetch(`/guardian-demo/scenarios/${scenarioId}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load scenario: ${response.statusText}`);
        }
        const loadedEvents: ScenarioEvent[] = await response.json();
        setCurrentScenarioEvents(loadedEvents);
        console.log(`Scenario ${scenarioId} loaded with ${loadedEvents.length} events`);
      } catch (err) {
        console.error('Error loading demo scenario:', err);
        setError(err instanceof Error ? err.message : 'Failed to load scenario data.');
        setCurrentScenarioEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Only load if switching is allowed OR it's the initial load (canSwitch is false)
    if (canSwitch || !intervalRef.current) {
      // The !intervalRef.current condition ensures initial load happens before lock
      loadScenarioData();
    } else {
      // If trying to switch too early, we just keep the old scenario running
      // (because the select is disabled, this useEffect won't run with a new ID)
    }

    // Cleanup interval on scenario change or unmount
    return () => clearSimulationInterval();
  }, [scenarioId, canSwitch, clearSimulationInterval]);

  // --- Simulation Interval --- //
  useEffect(() => {
    // Don't start interval if loading, errored, or no events loaded
    if (isLoading || error || currentScenarioEvents.length === 0) {
      clearSimulationInterval(); // Ensure stopped
      return;
    }

    // Start the interval if not already running
    // This effect should ONLY run when the scenario loads/changes, or loading/error state changes.
    // It should NOT run on every currentIndex change.
    if (!intervalRef.current) {
      const rate = simulationRates[scenarioId];
      console.log(`Starting simulation interval for ${scenarioId} at ${rate}ms/event`);

      intervalRef.current = setInterval(() => {
        // Read current state directly inside the interval callback
        // Use refs or rely on React's state update timing for currentIndex
        // Directly reading state here is generally safe for intervals

        // Use functional update for index to ensure we get the latest value
        setCurrentIndex((prevIndex) => {
          // Check if finished based on the index we *had* before this update
          if (prevIndex >= currentScenarioEvents.length) {
            console.log('Scenario finished (index check). Clearing interval.');
            clearSimulationInterval(); // Clear from within if finished
            return prevIndex; // Keep index as is
          }

          const eventData = currentScenarioEvents[prevIndex];

          // This check might be redundant if the index check above works
          if (!eventData) {
            console.log('Scenario finished (no event data). Clearing interval.');
            clearSimulationInterval();
            return prevIndex; // Stop index from incrementing
          }

          // Transform event
          const uniqueId = `${eventData.payload.id || 'event'}-${eventData.type}-${prevIndex}-${Date.now()}`;
          const newDemoEvent: DemoEvent = {
            id: uniqueId,
            type: eventData.type,
            amount: eventData.type === 'payout.paid' ? eventData.payload.amount : undefined,
            created: Date.now(), // Show as happening now
            flagged:
              eventData.payload.flagged === true ||
              (eventData.payload.metadata &&
                eventData.payload.metadata.guardian_action === 'paused'),
          };

          // Update displayed events
          setDisplayedEvents((prevDisplayed) =>
            [newDemoEvent, ...prevDisplayed].slice(0, MAX_DISPLAYED_EVENTS),
          );

          const nextIndex = prevIndex + 1;
          // Check if *this was* the last event, clear interval if so
          if (nextIndex >= currentScenarioEvents.length) {
            console.log('Scenario finished (last event processed). Clearing interval.');
            clearSimulationInterval(); // Clear from within
          }

          return nextIndex; // Return the updated index
        });
      }, rate);
    }

    // Cleanup function for THIS effect runs if deps change OR component unmounts
    return () => {
      console.log('Cleanup for simulation interval effect (deps changed or unmount)');
      // The intervalRef is cleared by clearSimulationInterval if called from within the interval
      // This cleanup handles the case where the effect re-runs due to external dep change (e.g. scenarioId)
      clearSimulationInterval();
    };

    // REMOVED currentIndex from dependencies
  }, [
    isLoading,
    error,
    currentScenarioEvents,
    scenarioId,
    clearSimulationInterval,
    simulationRates,
  ]);

  return (
    <>
      <div className="mt-4 mb-6 flex items-center gap-4">
        <label htmlFor="scenario-select" className="font-medium">
          Select Scenario:
        </label>
        <select
          id="scenario-select"
          className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
          disabled={!canSwitch || isLoading} // Disable if lock active or loading new scenario
        >
          {Object.entries(scenarios).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
        {!canSwitch && !isLoading && (
          <span className="text-sm text-gray-500">(Scenario switch locked for 45s)</span>
        )}
      </div>

      {error && <p className="text-red-600">Error: {error}</p>}

      <section className="mt-4">
        <EventTable events={displayedEvents} className="w-full" />
      </section>
    </>
  );
}
