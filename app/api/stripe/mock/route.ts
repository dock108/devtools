import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

const EventSchema = z.object({
  id: z.string(),
  type: z.string(),
  account: z.string(),
  created: z.number(),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const demoKey = req.headers.get('x-demo-key');
  if (demoKey !== process.env.DEMO_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parse = EventSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { id, type, account, created, amount = null, currency = 'usd' } = parse.data;

  const { error } = await supabaseAdmin.from('guardian_events').insert({
    id,
    type,
    account,
    amount_cents: amount,
    currency,
    event_time: new Date(created * 1000).toISOString(),
    raw: json,
    flagged: false,
  });
  if (error) {
    console.error('DB insert failed', error);
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
  }

  return NextResponse.json({ inserted: true }, { status: 201 });
}

export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
} 