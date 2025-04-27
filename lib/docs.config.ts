/**
 * Documentation site navigation configuration
 * This file defines the sidebar structure for the /docs site
 */

export interface DocLink {
  title: string;
  href: string;
  description?: string;
}

export interface DocGroup {
  title: string;
  items: DocLink[];
}

export const docsConfig: DocGroup[] = [
  {
    title: 'Getting Started',
    items: [
      {
        title: 'Introduction',
        href: '/docs',
        description: 'What is Stripe Guardian and how it helps your platform',
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
        description: 'Guidelines for creating content with Stripe Guardian',
      },
      {
        title: 'Feedback',
        href: '/docs/feedback',
        description: 'How to provide feedback on alerts',
      },
      {
        title: 'Notifications',
        href: '/docs/notifications',
        description: 'Configure alert notifications (mixed - will be redacted)',
      },
      {
        title: 'Rules',
        href: '/docs/rules',
        description: 'Understanding detection rules (mixed - will be redacted)',
      },
    ],
  },
  {
    title: 'Features',
    items: [
      {
        title: 'Alerts',
        href: '/docs/alerts',
        description: 'Managing and responding to alerts (mixed - will be redacted)',
      },
      {
        title: 'Analytics',
        href: '/docs/analytics',
        description: 'Understanding your alert data (mixed - will be redacted)',
      },
      {
        title: 'Risk Scoring',
        href: '/docs/risk-score',
        description: 'How risk scores are calculated (mixed - will be redacted)',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        title: 'Admin UI',
        href: '/docs/admin-ui',
        description: 'Admin interface overview (mixed - will be redacted)',
      },
      {
        title: 'Onboarding',
        href: '/docs/onboarding',
        description: 'Onboarding process (mixed - will be redacted)',
      },
    ],
  },
];

export default docsConfig;
