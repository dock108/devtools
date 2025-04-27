'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import docsConfig from '@/lib/docs.config';

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="relative h-full py-6 px-3 lg:px-4 overflow-y-auto">
      <div className="space-y-8">
        {docsConfig.map((group) => (
          <div key={group.title} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              {group.title}
            </h4>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'block px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground',
                      pathname === item.href
                        ? 'bg-accent/80 text-accent-foreground font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

// Create a renamed export for the client component
export const SidebarNavClient = SidebarNav;
