'use client';

import { useFakeStripeEvents } from './useFakeStripeEvents';
import { EventTable } from '@/components/guardian-demo/EventTable';
import VelocityChart from '@/components/guardian-demo/VelocityChart';
import ActionLog from '@/components/guardian-demo/ActionLog';
import SlackAlert from '@/components/guardian-demo/SlackAlert';
import { useState, useEffect } from 'react';

export function DemoViewer() {
  const [events, resetEvents] = useFakeStripeEvents({ onExpire: () => handleReset(true) });
  const [log, setLog] = useState<string[]>(['Monitoring started…']);
  const [alert, setAlert] = useState<{ text: string }>();

  function handleReset(auto = false) {
    resetEvents();
    setLog([auto ? 'Demo auto‑restarted after 5 min idle.' : 'Monitoring restarted…']);
    setAlert(undefined);
  }

  useEffect(() => {
    const latest = events[events.length - 1];
    if (latest?.flagged) {
      const amt = (latest.amount ?? 0) / 100;
      setLog((l) => [
        `⚠️ Velocity breach detected — 3 payouts in under 60 s.`,
        `⏸ Auto-pause triggered for payout ${latest.id}.`,
        ...l
      ].slice(0, 20));
      setAlert({
        text: `🚨 Payout auto‑paused: $${amt.toFixed(2)} (${latest.id.slice(0, 8)}…) – velocity breach.`,
      });
    }
  }, [events]);

  return (
    <>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => handleReset(false)}
          className="inline-flex items-center rounded-md border border-[var(--accent-guardian)] px-3 py-1 text-sm hover:bg-[var(--accent-guardian)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Restart demo"
          title="Restart demo"
        >
          Restart Demo
        </button>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <EventTable events={events} />
        <div className="rounded-2xl border border-[var(--accent-guardian)] p-4">
          <h2 className="mb-2 text-lg font-semibold">Payout Velocity (last 60&nbsp;s)</h2>
          <div className="h-[300px] overflow-hidden">
            <VelocityChart events={events} />
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Action Log</h2>
          <ActionLog entries={log} />
          <SlackAlert alert={alert} />
        </div>
      </div>
    </>
  );
} 