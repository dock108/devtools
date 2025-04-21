import template, { size as OG_SIZE } from '@/lib/og-template';

export const runtime = 'edge';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function rootFallbackOg() {
  return template({
    title: 'DOCK108 Tools',
    subtitle: 'Developer‑first fixes for real pain.',
    accent: '#38bdf8',
  });
} 