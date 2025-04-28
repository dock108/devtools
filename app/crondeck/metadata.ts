import { Metadata } from 'next';
import { productLD } from '@/lib/jsonld';

export const generateMetadata = (): Metadata => {
  const url = 'https://www.dock108.ai/crondeck';
  const image = `${url}/opengraph-image`;

  return {
    title: 'CronDeck – Cron & schedule monitor | DOCK108',
    description: 'Unified monitoring for Kubernetes CronJobs, GitHub Actions, and cloud tasks.',
    openGraph: {
      title: 'CronDeck – Cron & schedule monitor | DOCK108',
      description: 'Unified monitoring for Kubernetes CronJobs, GitHub Actions, and cloud tasks.',
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'CronDeck – Cron & schedule monitor | DOCK108',
      description: 'Unified monitoring for Kubernetes CronJobs, GitHub Actions, and cloud tasks.',
      images: [image],
    },
    other: {
      'script:type=application/ld+json': JSON.stringify(
        productLD({
          name: 'CronDeck',
          description:
            'Unified monitoring for Kubernetes CronJobs, GitHub Actions, and cloud tasks.',
          url,
          image,
          price: '0.00',
        }),
      ),
    },
  };
};
