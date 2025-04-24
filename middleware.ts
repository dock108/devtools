import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/utils/supabase/middleware';

// Security headers
const PROD_ORIGIN = 'https://www.dock108.ai';

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self';" +
    "style-src 'self' 'unsafe-inline';" +
    "font-src 'self' data:;" +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
    "img-src 'self' data: https://www.gravatar.com;" +
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

// Define paths that require authentication
const protectedPaths = [
  '/settings/',
  '/stripe-guardian/settings/',
  '/(auth)/', // Assuming this is an auth-related group
  '/stripe-guardian/onboard', // Add onboarding path
];

export async function middleware(request: NextRequest) {
  // Handle CORS pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Update the Supabase session first
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Create a Supabase client AFTER session update to check auth state
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Use request cookies because response cookies are not set yet
          return request.cookies.getAll();
        },
        // No need for set/remove here
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Redirect logged-in users from /login to the dashboard
  if (session && pathname === '/login') {
    const redirectUrl = new URL('/stripe-guardian/alerts', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if the current path requires authentication
  const requiresAuth = protectedPaths.some((path) => pathname.startsWith(path));

  // If path requires auth and user is not logged in, redirect to login
  if (requiresAuth && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    console.log(`Redirecting unauthenticated user from ${pathname} to ${loginUrl.toString()}`);
    // Return a new redirect response, not the one from updateSession
    return NextResponse.redirect(loginUrl);
  }

  // Add security and CORS headers to the response from updateSession (or the main response if no auth checks happened)
  Object.entries(securityHeaders).forEach(([k, v]) => response.headers.set(k, v));
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  // Return the response (potentially modified by updateSession)
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
