'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Label,
} from 'recharts';
import type { DemoEvent } from '@/app/guardian-demo/useFakeStripeEvents';

interface Props {
  events: DemoEvent[];
}

export default function VelocityChart({ events }: Props) {
  // Prepare payout data within last 60s
  const now = Date.now();
  const payouts = events
    .filter((e) => e.type === 'payout.paid')
    .map((e) => ({
      t: (now - e.created) / 1000, // seconds ago
      amt: (e.amount ?? 0) / 100, // cents -> dollars
      flagged: e.flagged,
    }))
    .filter((p) => p.t <= 60)
    .slice(-20) // safety cap
    .reverse(); // oldest first for chart

  const breachNow = payouts.filter((p) => p.t <= 60).length > 2;

  return (
    <div role="img" aria-label="Line chart of payout velocity for last 60 seconds" className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={payouts} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
          {breachNow && <ReferenceArea y1={0} y2="100%" fill="rgba(248,113,113,.3)" />}
          <XAxis
            dataKey="t"
            reversed
            tickFormatter={(s) => `${Math.round(60 - s)}s`}
            type="number"
            domain={[0, 60]}
          >
            <Label value="Seconds Ago" offset={-5} position="insideBottom" />
          </XAxis>
          <YAxis
            dataKey="amt"
            tickFormatter={(v) => `$${v}`}
            domain={[0, 'dataMax + 50']}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v: number) => `$${v.toFixed(2)}`}
            labelFormatter={(l) => `${Math.round(60 - (l as number))}s ago`}
          />
          <Line
            type="monotone"
            dataKey="amt"
            stroke="#38bdf8"
            strokeWidth={3}
            isAnimationActive={false}
            dot={{ r: 3, stroke: '#38bdf8', strokeWidth: 1, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 