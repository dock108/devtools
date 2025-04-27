'use client';

import { useDemoScenario } from './useDemoScenario';
import { EventTable } from '../../components/guardian-demo/EventTable';
import ActionLog from '../../components/guardian-demo/ActionLog';
import SlackAlert from '../../components/guardian-demo/SlackAlert';
import { ScenarioPicker } from '../../components/guardian-demo/ScenarioPicker';
import { getScenarios } from './getScenarios';
import { useState, useEffect } from 'react';
import { log } from '@/lib/logger';
import toast from 'react-hot-toast';

// Get scenarios at build time
const scenarioList = getScenarios();
const scenarioIds = scenarioList.map((s) => s.id);
const scenarioLabels = scenarioList.reduce<Record<string, string>>((acc, s) => {
  acc[s.id] = s.label;
  return acc;
}, {});

export function DemoViewer() {
  // Default to the first scenario instead of empty string
  const [scenario, setScenario] = useState<string>(scenarioIds.length > 0 ? scenarioIds[0] : '');
  const [speed, setSpeed] = useState(1);

  // We don't need fallback events anymore since we always use scenarios
  const scenarioData = useDemoScenario(scenario, {
    onExpire: () => handleReset(true),
    speed,
  });

  // Use scenario events
  const { events, isRunning, totalDelayMs } = scenarioData;

  const [log, setLog] = useState<string[]>(['Monitoring started…']);
  const [alert, setAlert] = useState<{ text: string }>();

  // Check for scenario completion
  useEffect(() => {
    // If the scenario was running but now stopped and has played all events
    if (!isRunning && events.length > 0 && events.length === scenarioData.total) {
      toast.success('Scenario complete. Click Restart to replay.');
    }
  }, [isRunning, events.length, scenarioData.total]);

  function handleReset(auto = false) {
    scenarioData.restart();
    setLog([auto ? 'Demo auto‑restarted after 5 min idle.' : 'Monitoring restarted…']);
    setAlert(undefined);
  }

  const handleScenarioChange = (newScenario: string) => {
    setScenario(newScenario);
    handleReset(false);
  };

  // Update the log message based on the scenario type
  useEffect(() => {
    const latest = events[events.length - 1];
    if (!latest?.flagged) return;

    const amt = (latest.amount ?? 0) / 100;
    let logMessage = `⚠️ Fraud detected in payout ${latest.id.slice(0, 8)}…`;
    let alertMessage = `🚨 Payout auto‑paused: $${amt.toFixed(2)} (${latest.id.slice(0, 8)}…)`;

    // Different messages based on scenario type
    if (scenario === 'velocity-breach') {
      logMessage = `⚠️ Velocity breach detected — 3 payouts in under 60s.`;
      alertMessage += ` – velocity breach`;
    } else if (scenario === 'bank-swap') {
      logMessage = `⚠️ Bank account swap detected — new account added recently.`;
      alertMessage += ` – suspicious bank account change`;
    } else if (scenario === 'geo-mismatch') {
      logMessage = `⚠️ Geo-location mismatch detected — payout from unusual location.`;
      alertMessage += ` – unusual location`;
    }

    setLog((l) =>
      [logMessage, `⏸ Auto-pause triggered for payout ${latest.id.slice(0, 8)}…`, ...l].slice(
        0,
        20,
      ),
    );

    setAlert({
      text: alertMessage,
    });
  }, [events, scenario]);

  return (
    <>
      <div className="mt-4">
        <ScenarioPicker
          scenarios={scenarioIds}
          scenarioLabels={scenarioLabels}
          currentScenario={scenario}
          onChange={handleScenarioChange}
          onRestart={() => handleReset(false)}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>
      <section className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <EventTable events={events} className="w-full" />
        <div>
          <h2 className="mb-2 text-lg font-semibold">Action Log</h2>
          <ActionLog entries={log} />
          <SlackAlert alert={alert} />
        </div>
      </section>
    </>
  );
}
