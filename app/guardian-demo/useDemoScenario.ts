'use client';

import { useEffect, useRef, useState } from 'react';
import { DemoEvent } from './useFakeStripeEvents';

export type ScenarioEvent = {
  delayMs: number;
  type: 'account.updated' | 'payout.paid';
  payload: Record<string, any>;
};

export type ScenarioOptions = {
  speed?: number;
  onExpire?: () => void;
};

export function useDemoScenario(
  scenarioName: string | null,
  options: ScenarioOptions = {}
) {
  const { speed = 1, onExpire } = options;
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const startRef = useRef<number>(Date.now());

  // Clear all timers on unmount or reset
  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
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
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/guardian-demo/scenarios/${name}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load scenario: ${response.statusText}`);
      }
      
      const data: ScenarioEvent[] = await response.json();
      setScenarioEvents(data);
      setIsLoading(false);
      setCurrentIndex(0);
      
      // Clear any existing events and timers before scheduling new ones
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
      setIsLoading(false);
    }
  };

  // Schedule the events based on the scenario
  const scheduleEvents = () => {
    clearAllTimers();
    const now = Date.now();
    startRef.current = now;
    
    scenarioEvents.forEach((event, index) => {
      const timer = setTimeout(() => {
        // Generate a truly unique ID by including a timestamp
        const uniqueId = `${event.payload.id || 'event'}-${event.type}-${index}-${Date.now()}`;
          
        // Convert scenario event to DemoEvent
        const demoEvent: DemoEvent = {
          id: uniqueId,
          type: event.type,
          amount: event.type === 'payout.paid' ? event.payload.amount : undefined,
          created: Date.now(),
          flagged: event.payload.flagged === true || 
                   (event.payload.metadata && event.payload.metadata.guardian_action === 'paused'),
        };
        
        setEvents(prev => [...prev.slice(-49), demoEvent]);
        setCurrentIndex(index + 1);
        
        // If this is the last event, expire after 5 minutes
        if (index === scenarioEvents.length - 1) {
          const expireTimer = setTimeout(() => {
            reset();
            onExpire?.();
          }, 300_000); // 5 minutes
          
          timersRef.current.push(expireTimer);
        }
      }, Math.max(0, event.delayMs / speed));
      
      timersRef.current.push(timer);
    });
  };

  // Load scenario effect
  useEffect(() => {
    if (scenarioName) {
      loadScenario(scenarioName);
    }
    
    return () => {
      clearAllTimers();
    };
  }, [scenarioName]);

  // Schedule events when scenario data is loaded
  useEffect(() => {
    if (scenarioEvents.length > 0) {
      scheduleEvents();
    }
  }, [scenarioEvents, speed]);

  return {
    events,
    currentIndex,
    total: scenarioEvents.length,
    isLoading,
    error,
    restart,
    reset
  };
} 