import { useEffect, useState } from 'react';

export function Countdown({ totalMs, isRunning }: { totalMs: number; isRunning: boolean }) {
  const [remaining, setRemaining] = useState(totalMs);
  useEffect(() => { setRemaining(totalMs); }, [totalMs]);              // reset on Restart
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setRemaining((r) => Math.max(r - 1000, 0)), 1000);
    return () => clearInterval(id);
  }, [isRunning]);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  return <span className="text-sm font-medium">{mm}:{ss} remaining</span>;
} 