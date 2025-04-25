'use client'; // Required for usePathname

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/docs'; // Assuming NavItem interface is exported
import { useState } from 'react';
import { Menu, X } from 'lucide-react'; // Icons for mobile toggle

interface SidebarProps {
  navigation: NavItem[];
}

export function Sidebar({ navigation }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navContent = (
    <nav className="px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">Documentation</h2>
      <ul className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.url;
          return (
            <li key={item.slug}>
              <Link 
                href={item.url}
                onClick={() => setIsMobileOpen(false)} // Close mobile menu on click
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${ 
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Mobile Toggle Button - fixed position top-right */}
      <button 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 right-4 z-50 p-2 rounded-md bg-background text-foreground border md:hidden" // Only show on mobile
        aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Sidebar - absolutely positioned, slides in/out or overlays */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-background border-r transform transition-transform duration-300 ease-in-out md:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {navContent}
      </aside>

      {/* Desktop Sidebar - standard layout */}
      <aside className="hidden md:block w-64 border-r bg-background sticky top-0 h-screen overflow-y-auto">
        {navContent}
      </aside>
    </>
  );
} 