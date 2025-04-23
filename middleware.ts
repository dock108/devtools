import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/utils/supabase/middleware';

// Security headers
const PROD_ORIGIN = 'https://www.dock108.ai';

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self';" +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
    'font-src https://fonts.gstatic.com;' +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
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

// Public paths that don't require authentication
const publicPaths = [
  '/login',
  '/',
  '/blog',
  '/docs',
  '/api/stripe/webhook',
  '/api/webhooks',
  '/stripe-guardian',
  '/guardian-demo',
  '/notary-ci',
  '/crondeck',
  '/api/waitlist',
];

function isPublicPath(path: string): boolean {
  return publicPaths.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
}

export async function middleware(request: NextRequest) {
  // Handle CORS pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get the pathname from the URL
  const { pathname } = request.nextUrl;

  // Special case for settings and dedicated auth pages
  if (
    pathname.startsWith('/settings/') ||
    pathname.startsWith('/stripe-guardian/settings/') ||
    pathname.startsWith('/(auth)/')
  ) {
    // Update the Supabase auth session
    const response = await updateSession(request);

    // Check if user is authenticated
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          set() {}, // No-op as we're not setting cookies in middleware check
          remove() {}, // No-op as we're not removing cookies in middleware check
          setAll() {}, // No-op
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If the user is not authenticated and trying to access a settings path,
    // redirect them to the login page
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Add security headers
    Object.entries(securityHeaders).forEach(([k, v]) => response.headers.set(k, v));
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

    return response;
  }

  // Regular middleware for all other paths
  const response = await updateSession(request);

  // Add security headers
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
