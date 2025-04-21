'use client';

import { DemoEvent } from '@/app/guardian-demo/useFakeStripeEvents';

interface Props {
  events: DemoEvent[];
}

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function EventTable({ events }: Props) {
  return (
    <div className="overflow-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-700">Time</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-700">Type</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-700">Amount</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-700">Flag</th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt) => (
            <tr
              key={evt.id}
              className={evt.flagged ? 'bg-red-50' : undefined}
            >
              <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                {timeFormatter.format(evt.created)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                {evt.type}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                {evt.amount ? `$${(evt.amount / 100).toFixed(2)}` : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                {evt.flagged ? '🚩' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 