'use client';

import { DemoEvent } from '@/app/guardian-demo/useFakeStripeEvents';
import { useRef, useEffect } from 'react';
import { dateTimeFormatter, currencyFormatter } from '@/lib/formatters';

interface Props {
  events: DemoEvent[];
  className?: string;
}

export function EventTable({ events, className = '' }: Props) {
  // Keep track of rendered events to ensure unique keys
  const renderedEvents = useRef<Set<string>>(new Set());

  // Clear the rendered events cache when component unmounts
  useEffect(() => {
    const currentRenderedEvents = renderedEvents.current;
    return () => {
      currentRenderedEvents.clear();
    };
  }, []);

  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
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
          {events.map((evt, index) => {
            // Create a truly unique key for each event row
            const uniqueKey = `${evt.id}-${index}-${evt.created}`;

            // If this key was already rendered, make it even more unique
            if (renderedEvents.current.has(uniqueKey)) {
              const trueUniqueKey = `${uniqueKey}-${Date.now()}`;
              renderedEvents.current.add(trueUniqueKey);
              return (
                <tr key={trueUniqueKey} className={evt.flagged ? 'bg-red-50' : undefined}>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                    {dateTimeFormatter.format(evt.created)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-900">{evt.type}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                    {evt.amount ? currencyFormatter.format(evt.amount / 100) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                    {evt.flagged ? '🚩' : ''}
                  </td>
                </tr>
              );
            }

            // Store the key as rendered
            renderedEvents.current.add(uniqueKey);

            return (
              <tr key={uniqueKey} className={evt.flagged ? 'bg-red-50' : undefined}>
                <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                  {dateTimeFormatter.format(evt.created)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-900">{evt.type}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                  {evt.amount ? currencyFormatter.format(evt.amount / 100) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                  {evt.flagged ? '🚩' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
