'use client';

import { useDemoScenario } from './useDemoScenario';
import { EventTable } from '../../components/guardian-demo/EventTable';
import VelocityChart from '../../components/guardian-demo/VelocityChart';
import ActionLog from '../../components/guardian-demo/ActionLog';
import SlackAlert from '../../components/guardian-demo/SlackAlert';
import { ScenarioPicker } from '../../components/guardian-demo/ScenarioPicker';
import { getScenarios } from './getScenarios';
import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

// Get scenarios at build time
const scenarioList = getScenarios();
const scenarioIds = scenarioList.map(s => s.id);
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
    speed,
    onExpire: () => handleReset(true)
  });
  
  // Use scenario events
  const events = scenarioData.events;
  
  const [log, setLog] = useState<string[]>(['Monitoring started…']);
  const [alert, setAlert] = useState<{ text: string }>();

  function handleReset(auto = false) {
    scenarioData.restart();
    setLog([auto ? 'Demo auto‑restarted after 5 min idle.' : 'Monitoring restarted…']);
    setAlert(undefined);
  }
  
  function handleScenarioChange(newScenario: string) {
    logger.info({ newScenario }, 'Changing scenario');
    setScenario(newScenario);
    handleReset(false);
  }

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
    
    setLog((l) => [
      logMessage,
      `⏸ Auto-pause triggered for payout ${latest.id.slice(0, 8)}…`,
      ...l
    ].slice(0, 20));
    
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
          speedFactor={speed}
          onSpeedChange={setSpeed}
          currentIndex={scenarioData.currentIndex}
          totalEvents={scenarioData.total}
          onRestart={() => handleReset(false)}
        />
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