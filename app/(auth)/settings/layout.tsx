'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { slug: 'profile',            label: 'Profile' },
    { slug: 'notifications',      label: 'Notifications' },
  ];

  return (
    <section className="mx-auto max-w-4xl space-y-8 py-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <nav className="flex gap-2">
        {tabs.map(({ slug, label }) => (
          <Link
            key={slug}
            href={`/settings/${slug}`}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              pathname === `/settings/${slug}`
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* tab content */}
      {children}
    </section>
  );
} 