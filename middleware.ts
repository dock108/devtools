import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROD_ORIGIN = 'https://www.dock108.ai';

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self';" +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
    "font-src https://fonts.gstatic.com;" +
    "script-src 'self' 'unsafe-inline';" +
    "img-src 'self' data:;" +
    "connect-src 'self' https://*.supabase.co https://api.stripe.com;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': PROD_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function middleware(req: NextRequest) {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const res = NextResponse.next();
  Object.entries(securityHeaders).forEach(([k, v]) => res.headers.set(k, v));
  Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  runtime: 'experimental-edge',
};
