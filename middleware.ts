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

  // Update the Supabase session for all applicable requests
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Check if the current path requires authentication
  const requiresAuth = protectedPaths.some((path) => pathname.startsWith(path));

  if (requiresAuth) {
    // Check if user is authenticated using a temporary client
    // Note: updateSession already refreshed the cookie if needed
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          // Read-only operations, no need for set/remove
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If no session and path requires auth, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      console.log(`Redirecting unauthenticated user from ${pathname} to ${loginUrl.toString()}`); // Debug log
      return NextResponse.redirect(loginUrl);
    }
    console.log(`User is authenticated for protected path: ${pathname}`); // Debug log
  }

  // Add security and CORS headers to all responses
  Object.entries(securityHeaders).forEach(([k, v]) => response.headers.set(k, v));
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

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
