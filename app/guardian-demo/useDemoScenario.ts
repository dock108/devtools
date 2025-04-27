'use client';

import { useEffect, useRef, useState } from 'react';
import { DemoEvent } from './useFakeStripeEvents';

export type ScenarioEvent = {
  delayMs: number;
  type: 'account.updated' | 'payout.paid';
  payload: Record<string, any>;
};

export type ScenarioOptions = {
  onExpire?: () => void;
  speed?: number;
};

export function useDemoScenario(scenarioName: string | null, options: ScenarioOptions = {}) {
  const { onExpire, speed = 1 } = options;
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalDelayMs, setTotalDelayMs] = useState<number>(0);

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const startRef = useRef<number>(Date.now());
  const fetchControllerRef = useRef<AbortController | null>(null);
  const pendingEventsRef = useRef<
    Array<{ event: ScenarioEvent; index: number; scheduledAt: number }>
  >([]);

  // Clear all timers on unmount or reset
  const clearAllTimers = () => {
    if (timersRef.current.length > 0) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    pendingEventsRef.current = [];
    setIsRunning(false);
  };

  const reset = () => {
    clearAllTimers();
    setEvents([]);
    setCurrentIndex(0);
    startRef.current = Date.now();
  };

  const restart = (newScenarioName?: string) => {
    reset();
    if (newScenarioName) {
      loadScenario(newScenarioName);
    } else if (scenarioName) {
      scheduleEvents();
    }
  };

  // Load scenario data
  const loadScenario = async (name: string) => {
    if (!name) return;

    // Cancel any pending fetch
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    // Create new controller for this fetch
    fetchControllerRef.current = new AbortController();
    const signal = fetchControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/guardian-demo/scenarios/${name}.json`, { signal });
      if (!response.ok) {
        throw new Error(`Failed to load scenario: ${response.statusText}`);
      }

      const data: ScenarioEvent[] = await response.json();
      setScenarioEvents(data);

      // Calculate total delay time from all events
      const total = data.reduce((sum, event) => sum + event.delayMs, 0);
      setTotalDelayMs(total);

      setIsLoading(false);
      setCurrentIndex(0);

      // Clear any existing events and timers before scheduling new ones
      reset();
    } catch (err) {
      // Don't set error if aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
      setIsLoading(false);
    }
  };

  // Schedule the events based on the scenario
  const scheduleEvents = () => {
    clearAllTimers();
    const now = Date.now();
    startRef.current = now;
    setIsRunning(true);

    // Track pending events with information about when they were scheduled
    pendingEventsRef.current = scenarioEvents.map((event, index) => ({
      event,
      index,
      scheduledAt: now,
    }));

    // Schedule all events
    scenarioEvents.forEach((event, index) => {
      const timer = setTimeout(
        () => {
          // Generate a truly unique ID by including a timestamp
          const uniqueId = `${event.payload.id || 'event'}-${event.type}-${index}-${Date.now()}`;

          // Convert scenario event to DemoEvent
          const demoEvent: DemoEvent = {
            id: uniqueId,
            type: event.type,
            amount: event.type === 'payout.paid' ? event.payload.amount : undefined,
            created: Date.now(),
            flagged:
              event.payload.flagged === true ||
              (event.payload.metadata && event.payload.metadata.guardian_action === 'paused'),
          };

          // Remove this event from pending events ref
          pendingEventsRef.current = pendingEventsRef.current.filter(
            (pe) => !(pe.index === index && pe.event === event),
          );

          setEvents((prev) => [...prev.slice(-49), demoEvent]);
          setCurrentIndex(index + 1);

          // If this is the last event, stop the scenario and set timer to expire after 5 minutes
          if (index === scenarioEvents.length - 1) {
            setIsRunning(false);

            const expireTimer = setTimeout(() => {
              reset();
              onExpire?.();
            }, 300_000); // 5 minutes

            timersRef.current.push(expireTimer);
          }
        },
        Math.max(0, event.delayMs / speed),
      );

      timersRef.current.push(timer);
    });
  };

  // Reschedule events when speed changes
  const rescheduleEvents = () => {
    if (pendingEventsRef.current.length === 0) return;

    clearAllTimers();
    const now = Date.now();
    const elapsed = now - startRef.current;
    setIsRunning(true);

    // For each pending event, calculate the new delay based on elapsed time
    pendingEventsRef.current.forEach(({ event, index }) => {
      const originalDelay = event.delayMs;
      // Adjust delay based on elapsed time
      const adjustedDelay = Math.max(0, originalDelay - elapsed);

      // Schedule with new delay
      const timer = setTimeout(
        () => {
          // Generate a truly unique ID by including a timestamp
          const uniqueId = `${event.payload.id || 'event'}-${event.type}-${index}-${Date.now()}`;

          // Convert scenario event to DemoEvent
          const demoEvent: DemoEvent = {
            id: uniqueId,
            type: event.type,
            amount: event.type === 'payout.paid' ? event.payload.amount : undefined,
            created: Date.now(),
            flagged:
              event.payload.flagged === true ||
              (event.payload.metadata && event.payload.metadata.guardian_action === 'paused'),
          };

          // Remove this event from pending events ref
          pendingEventsRef.current = pendingEventsRef.current.filter(
            (pe) => !(pe.index === index && pe.event === event),
          );

          setEvents((prev) => [...prev.slice(-49), demoEvent]);
          setCurrentIndex(index + 1);

          // If this is the last event, stop running and set timer to expire
          if (index === scenarioEvents.length - 1) {
            setIsRunning(false);

            const expireTimer = setTimeout(() => {
              reset();
              onExpire?.();
            }, 300_000); // 5 minutes

            timersRef.current.push(expireTimer);
          }
        },
        Math.max(0, adjustedDelay / speed),
      );

      timersRef.current.push(timer);
    });
  };

  // Load scenario effect
  useEffect(() => {
    if (scenarioName) {
      clearAllTimers();
      loadScenario(scenarioName);
    }

    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
      clearAllTimers();
    };
  }, [scenarioName]);

  // Schedule events when scenario data is loaded
  useEffect(() => {
    if (scenarioEvents.length > 0) {
      scheduleEvents();
    }
  }, [scenarioEvents]);

  // Reschedule when speed changes
  useEffect(() => {
    if (scenarioEvents.length > 0 && pendingEventsRef.current.length > 0) {
      rescheduleEvents();
    }
  }, [speed]);

  return {
    events,
    currentIndex,
    total: scenarioEvents.length,
    isLoading,
    error,
    restart,
    reset,
    isRunning,
    totalDelayMs,
  };
}
