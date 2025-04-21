'use client';

import { useEffect, useRef, useState } from 'react';

export default function ActionLog({ entries }: { entries: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const pageSize = 15;
  const visible = entries.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    ref.current?.scroll({ top: 0 });
  }, [visible]);

  return (
    <div>
      <div
        className="h-60 overflow-auto rounded-2xl border border-[var(--accent-guardian)] bg-gray-50 p-4 font-mono text-sm"
        ref={ref}
      >
        {visible.length === 0 ? (
          <p className="text-gray-400">Waiting for events…</p>
        ) : (
          <ul className="space-y-1">
            {visible.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      {page * pageSize + pageSize < entries.length && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="mt-2 text-sm text-[var(--accent-guardian)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Show older log entries"
        >
          Show older ↓
        </button>
      )}
    </div>
  );
} 