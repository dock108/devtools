import template, { size as OG_SIZE } from '@/lib/og-template';

export const runtime = 'edge';
export const alt = 'Notary CI';
export const contentType = 'image/png';
export const size = OG_SIZE;

export default function notaryCiOg() {
  return template({
    title: 'Automate macOS notarization in CI.',
    subtitle: 'Release notarized apps without manual steps',
    accent: '#f472b6',
  });
} 