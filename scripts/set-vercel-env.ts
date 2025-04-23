/*
 * Sync local secrets to Vercel.
 * Usage: pnpm ts-node scripts/set-vercel-env.ts
 */
import { execSync } from 'node:child_process';

const required = [
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
] as const;

required.forEach((k) => {
  if (!process.env[k]) {
    console.error(`⛔️  Missing env var: ${k}`);
    process.exit(1);
  }
});

console.log('Pushing env vars to Vercel…');
required.forEach((k) => {
  execSync(`vercel env add secret ${k} ${process.env[k]}`, { stdio: 'inherit' });
});
console.log('✅  Vercel env sync complete');
