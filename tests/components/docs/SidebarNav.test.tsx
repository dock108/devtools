import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SidebarNav } from '@/components/docs/SidebarNav';
import docsConfig from '@/lib/docs.config';

// Mock the next/navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/docs/getting-started'),
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
          href: '/docs/getting-started',
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

    // Find the active link (getting-started)
    const activeLink = screen.getByText('Quick Start');

    // Check that it has the active class (using the parent element since the text is inside a Link component)
    expect(activeLink.parentElement).toHaveClass('bg-accent/80');

    // Check that other links do not have the active class
    const inactiveLink = screen.getByText('Introduction');
    expect(inactiveLink.parentElement).not.toHaveClass('bg-accent/80');
  });
});
