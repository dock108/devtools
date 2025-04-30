import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SidebarNav } from '@/components/docs/SidebarNav';
import docsConfig from '@/lib/docs.config';

// Mock the next/navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/docs'),
}));

// Mock the docsConfig
vi.mock('@/lib/docs.config', () => ({
  default: [
    {
      title: 'Getting Started',
      items: [
        {
          title: 'Introduction',
          href: '/docs',
          description: 'Introduction to Stripe Guardian',
        },
        {
          title: 'Quick Start',
          href: '/docs',
          description: 'Get up and running with Stripe Guardian',
        },
      ],
    },
    {
      title: 'Core Concepts',
      items: [
        {
          title: 'Content Guidelines',
          href: '/docs/content-guidelines',
          description: 'Guidelines for creating content',
        },
      ],
    },
  ],
}));

describe('SidebarNav', () => {
  it('renders all section headings', () => {
    render(<SidebarNav />);

    // Check that all group titles are rendered
    docsConfig.forEach((group) => {
      expect(screen.getByText(group.title)).toBeInTheDocument();
    });
  });

  it('renders all navigation links', () => {
    render(<SidebarNav />);

    // Check that all links are rendered
    const allLinks = docsConfig.flatMap((group) => group.items);
    allLinks.forEach((item) => {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    });
  });

  it('highlights the active link', () => {
    render(<SidebarNav />);

    // Find the active link (now Introduction, assuming /docs is the current path)
    const activeLink = screen.getByText('Introduction');

    // Check that IT has the active class, not its parent
    expect(activeLink).toHaveClass('bg-accent/80');

    // Check that other links do not have the active class
    const inactiveLink = screen.getByText('Quick Start');
    expect(inactiveLink).not.toHaveClass('bg-accent/80');
    // Optionally, check if it has the inactive class
    // expect(inactiveLink).toHaveClass('text-muted-foreground');
  });
});
