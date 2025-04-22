import Stripe from 'stripe';

const apiVersion: Stripe.LatestApiVersion = '2024-04-10'; // keep in sync with Stripe docs

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('⛔️  STRIPE_SECRET_KEY env var is missing.');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('⛔️  STRIPE_WEBHOOK_SECRET env var is missing.');
}

// Reuse across hot reloads in dev
const globalForStripe = global as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion,
    appInfo: { name: 'Stripe Guardian', version: '0.1.0' },
  });

if (process.env.NODE_ENV !== 'production') globalForStripe.stripe = stripe;

// Re-export Stripe types
export type { Stripe }; 