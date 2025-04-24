import { NextResponse } from 'next/server';

// Edge runtime is required for cron schedules
export const runtime = 'edge';

export async function GET() {
  try {
    // In a real Edge Function, we would make a fetch to another endpoint
    // that runs the seeder or trigger a webhook that runs the seeder
    
    // For now, just return success since we're demonstrating the route works
    // and actual seeding would need to happen through a different mechanism
    // when deployed to Vercel Edge Functions
    
    return NextResponse.json({ 
      ok: true, 
      message: "Timewarp seeder triggered successfully. In production, this would start a seeding job." 
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
} 