'use client';

import { useEffect, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';

export type DemoEvent = {
  id: string;
  type: 'account.updated' | 'payout.paid';
  amount?: number;
  created: number; // unix timestamp (ms)
  flagged?: boolean;
};

export function useFakeStripeEvents(
  opts: { intervalMs?: number; velocityLimit?: number; onExpire?: () => void } = {}
) {
  const { intervalMs = 3000, velocityLimit = 3, onExpire } = opts;
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const payoutTimestamps = useRef<number[]>([]);
  const startRef = useRef<number>(Date.now());

  const reset = () => {
    payoutTimestamps.current = [];
    startRef.current = Date.now();
    setEvents([]);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - startRef.current > 300_000) {
        reset();
        onExpire?.();
        return;
      }

      const isPayout = Math.random() > 0.4; // 60% chance payout, 40% account update
      let flagged = false;

      if (isPayout) {
        // Slide the window to last 60s
        payoutTimestamps.current = payoutTimestamps.current.filter(
          (ts) => now - ts < 60_000
        );
        payoutTimestamps.current.push(now);

        if (payoutTimestamps.current.length > velocityLimit) {
          flagged = true;
          payoutTimestamps.current = []; // reset for demo simplicity
        }
      }

      const evt: DemoEvent = {
        id: faker.string.uuid(),
        type: isPayout ? 'payout.paid' : 'account.updated',
        amount: isPayout ? faker.number.int({ min: 5_00, max: 50_00 }) : undefined, // cents
        created: now,
        flagged,
      };

      setEvents((prev) => [...prev.slice(-49), evt]); // keep last 50 events
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, velocityLimit, onExpire]);

  return [events, reset] as const;
} 