import template, { size as OG_SIZE } from '@/lib/og-template';

export const runtime = 'edge';
export const alt = 'Stripe Guardian';
export const contentType = 'image/png';
export const size = OG_SIZE;

export default function stripeGuardianOg() {
  return template({
    title: 'Freeze fraudulent Stripe payouts.',
    subtitle: 'Real‑time velocity rules & auto‑pause',
    accent: '#38bdf8',
  });
} 