import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Log NODE_ENV once at the top level
console.log('[Middleware] NODE_ENV:', process.env.NODE_ENV);

// Security headers
const PROD_ORIGIN = 'https://www.dock108.ai';
const DEV_ORIGIN = 'http://localhost:3000'; // Define dev origin

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [PROD_ORIGIN]
    : [PROD_ORIGIN, DEV_ORIGIN, 'https://connect.stripe.com']; // Allow dev and Stripe Connect in non-prod

const securityHeaders = (origin: string | null): Record<string, string> => {
  // Define CSP parts
  const defaultSrc = "default-src 'self';";
  const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval';"; // Keep existing, maybe tighten later
  const styleSrc =
    "style-src 'self' 'unsafe-inline' https://connect.stripe.com https://stripe.com;"; // ADD Stripe
  const imgSrc =
    "img-src 'self' data: https://www.gravatar.com https://*.stripe.com https://*.stripe.network;"; // ADD Stripe
  const connectSrc =
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://connect.stripe.com https://r.stripe.com;"; // Already includes connect.stripe.com and r.stripe.com
  const fontSrc = "font-src 'self' data:;";
  const frameSrc = "frame-src 'self' https://connect.stripe.com https://stripe.com;"; // ADD Stripe
  const frameAncestors = "frame-ancestors 'self' https://connect.stripe.com https://stripe.com;"; // ADD Stripe

  // Combine directives
  const csp = [
    defaultSrc,
    scriptSrc,
    styleSrc,
    imgSrc,
    connectSrc,
    fontSrc,
    frameSrc,
    frameAncestors,
  ].join(' ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // X-Frame-Options is redundant with frame-ancestors
  };
};

const corsHeaders = (origin: string | null): Record<string, string> => {
  const effectiveOrigin = origin && allowedOrigins.includes(origin) ? origin : PROD_ORIGIN;
  console.log(
    `[Middleware] Calculating CORS for origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}. Effective Origin: ${effectiveOrigin}`,
  ); // Log CORS calculation
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin', // Important for caching based on origin
  };
};

// Define paths that require authentication
const protectedPaths = [
  '/settings', // Protects /settings and /settings/*
  '/stripe-guardian/analytics', // Protect analytics dashboard
  '/stripe-guardian/alerts', // Protect alerts dashboard
  // '/admin', // Assuming admin routes handle their own auth/layout
  // /guardian-demo is now public
  // /info is assumed public (not listed)
  // /stripe-guardian product page is now public
];

export async function middleware(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  console.log(`[Middleware] Handling request for: ${requestPath}`); // Log path
  const requestOrigin = request.headers.get('origin');

  // Create an outgoing response object based on the incoming request
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Handle CORS pre-flight first
  if (request.method === 'OPTIONS') {
    console.log('[Middleware] Handling OPTIONS pre-flight');
    const corsPreflightHeaders = corsHeaders(requestOrigin);
    return new Response(null, {
      status: 204,
      headers: corsPreflightHeaders,
    });
  }

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request cookies and response object
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request cookies and response object
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    },
  );

  // Refresh session if expired - important!
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // *** Debug Logging ***
  console.log('[Middleware] Session Check Result:', !!session, 'Path:', requestPath);

  // --- Authentication Logic ---
  const isProtectedRoute = protectedPaths.some((path) => requestPath.startsWith(path));

  if (!session && isProtectedRoute) {
    console.log(
      `[Middleware] Redirecting unauthenticated user from protected path: ${requestPath}`,
    );
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', requestPath); // Use 'next' query param
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from /login or /sign-up
  if (session && (requestPath === '/login' || requestPath === '/sign-up')) {
    console.log(`[Middleware] Redirecting logged-in user from ${requestPath}`);
    const redirectUrl = new URL('/stripe-guardian/alerts', request.url); // Redirect to alerts page
    return NextResponse.redirect(redirectUrl);
  }
  // --- End Auth Logic ---

  // Add security and CORS headers to the final response
  const finalCorsHeaders = corsHeaders(requestOrigin);
  const finalSecurityHeaders = securityHeaders(requestOrigin);
  Object.entries(finalSecurityHeaders).forEach(([k, v]) => response.headers.set(k, v));
  Object.entries(finalCorsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  console.log('[Middleware] Returning final response.');
  return response;
}

// Update matcher to exclude static assets and API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - images/ (public images)
     * - favicon.ico (favicon file)
     * - various static file extensions.
     */
    '/((?!api|_next/static|_next/image|images|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
