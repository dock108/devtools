/**
 * Documentation site navigation configuration
 * This file defines the sidebar structure for the /docs site
 */

export interface DocLink {
  title: string;
  href: string;
  description?: string;
  slug?: string;
}

export interface DocGroup {
  title: string;
  items: DocLink[];
}

export const docsConfig: DocGroup[] = [
  {
    title: 'Start',
    items: [
      {
        title: 'Getting Started',
        href: '/docs/getting-started',
        description: 'Get up and running with Stripe Guardian',
        slug: 'getting-started',
      },
    ],
  },
  {
    title: 'Concepts',
    items: [
      {
        title: 'How Alerts Work',
        href: '/docs/alerts',
        description:
          'Learn how Guardian turns Stripe events into actionable alerts with risk scores',
        slug: 'alerts',
      },
      {
        title: 'Rules & Risk Scoring',
        href: '/docs/rules-and-risk',
        description: 'Understanding detection rules and how risk scores are calculated',
        slug: 'rules-and-risk',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Notifications',
        href: '/docs/notifications',
        description: 'Configure alert notifications for your team',
        slug: 'notifications',
      },
      {
        title: 'FAQ',
        href: '/docs/faq',
        description: 'Frequently asked questions about Stripe Guardian',
        slug: 'faq',
      },
    ],
  },
];

export const docsNav = [
  {
    heading: 'Start',
    links: [{ title: 'Getting Started', slug: 'getting-started' }],
  },
  {
    heading: 'Concepts',
    links: [
      { title: 'How Alerts Work', slug: 'alerts' },
      { title: 'Rules & Risk Scoring', slug: 'rules-and-risk' },
    ],
  },
  {
    heading: 'Operations',
    links: [
      { title: 'Notifications', slug: 'notifications' },
      { title: 'FAQ', slug: 'faq' },
    ],
  },
];

export default docsConfig;
