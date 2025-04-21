import template, { size as OG_SIZE } from '@/lib/og-template';

export const runtime = 'edge';
export const alt = 'CronDeck';
export const contentType = 'image/png';
export const size = OG_SIZE;

export default function crondeckOg() {
  return template({
    title: 'Monitor every cron & schedule.',
    subtitle: 'Unified dashboard & smart alerts',
    accent: '#8b5cf6',
  });
} 