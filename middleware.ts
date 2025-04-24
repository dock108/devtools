import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/utils/supabase/middleware';

// Log NODE_ENV once at the top level
console.log('[Middleware] NODE_ENV:', process.env.NODE_ENV);

// Security headers
const PROD_ORIGIN = 'https://www.dock108.ai';
const DEV_ORIGIN = 'http://localhost:3000'; // Define dev origin

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [PROD_ORIGIN] 
  : [PROD_ORIGIN, DEV_ORIGIN, 'https://connect.stripe.com']; // Allow dev and Stripe Connect in non-prod

const securityHeaders = (origin: string | null): Record<string, string> => {
  // Basic CSP, relax frame-ancestors to allow self and stripe connect
  const csp = 
    "default-src 'self';" +
    "style-src 'self' 'unsafe-inline';" +
    "font-src 'self' data:;" +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
    "img-src 'self' data: https://www.gravatar.com;" +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://connect.stripe.com https://r.stripe.com;" +
    `frame-ancestors 'self' ${allowedOrigins.includes('https://connect.stripe.com') ? 'https://connect.stripe.com' : ''};`; // Allow framing from connect.stripe.com if allowed

  return {
    'Content-Security-Policy': csp,
    // 'X-Frame-Options': 'DENY', // Remove this as CSP frame-ancestors is preferred
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
};

const corsHeaders = (origin: string | null): Record<string, string> => {
  const effectiveOrigin = origin && allowedOrigins.includes(origin) ? origin : PROD_ORIGIN;
  console.log(`[Middleware] Calculating CORS for origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}. Effective Origin: ${effectiveOrigin}`); // Log CORS calculation
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin', // Important for caching based on origin
  };
};

// Define paths that require authentication
const protectedPaths = [
  '/settings/',
  '/stripe-guardian/settings/',
  '/(auth)/', // Assuming this is an auth-related group
  '/stripe-guardian/onboard', // Add onboarding path
];

export async function middleware(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  console.log(`[Middleware] Handling request for: ${requestPath}`); // Log path
  const requestOrigin = request.headers.get('origin');
  console.log(`[Middleware] Request Origin header: ${requestOrigin}`); // Log origin header
  
  const currentCorsHeaders = corsHeaders(requestOrigin);
  const currentSecurityHeaders = securityHeaders(requestOrigin);
  console.log('[Middleware] Calculated CORS Headers:', currentCorsHeaders); // Log calculated headers

  // Handle CORS pre-flight
  if (request.method === 'OPTIONS') {
    console.log('[Middleware] Handling OPTIONS pre-flight');
    return new Response(null, {
      status: 204,
      headers: currentCorsHeaders, // Use dynamic CORS headers
    });
  }

  // Update the Supabase session first
  console.log('[Middleware] Calling updateSession...');
  const response = await updateSession(request);
  const { pathname } = request.nextUrl; // pathname is already available from requestPath

  // --- Authentication/Authorization Logic --- 
  let session = null;
  try {
    console.log('[Middleware] Creating Supabase client to check auth...');
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
        },
      }
    );
    const { data } = await supabase.auth.getSession();
    session = data.session; // Assign session data
    console.log(`[Middleware] Session check complete. User is ${session ? 'logged in' : 'not logged in'}.`);
  } catch (e) {
    console.error('[Middleware] Error checking session:', e);
  }

  // Redirect logged-in users from /login
  if (session && pathname === '/login') {
    console.log('[Middleware] Redirecting logged-in user from /login');
    const redirectUrl = new URL('/stripe-guardian/alerts', request.url);
    return NextResponse.redirect(redirectUrl); // Note: Headers aren't automatically added to this redirect currently
  }

  // Redirect unauthenticated users from protected paths
  const requiresAuth = protectedPaths.some((path) => pathname.startsWith(path));
  if (requiresAuth && !session) {
    console.log(`[Middleware] Redirecting unauthenticated user from protected path: ${pathname}`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Add headers to the redirect response
    Object.entries(currentSecurityHeaders).forEach(([k, v]) => redirectResponse.headers.set(k, v));
    Object.entries(currentCorsHeaders).forEach(([k, v]) => redirectResponse.headers.set(k, v));
    console.log('[Middleware] Returning redirect response with headers.');
    return redirectResponse;
  }
  // --- End Auth Logic ---

  // Add security and CORS headers to the main response
  console.log('[Middleware] Applying headers to main response...');
  Object.entries(currentSecurityHeaders).forEach(([k, v]) => response.headers.set(k, v));
  Object.entries(currentCorsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  console.log('[Middleware] Final Response Headers:', Object.fromEntries(response.headers.entries())); // Log final headers

  // Return the response (potentially modified by updateSession)
  console.log('[Middleware] Returning main response.');
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
