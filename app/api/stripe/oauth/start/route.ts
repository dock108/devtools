import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  // Generate a random state to prevent CSRF attacks
  const state = crypto.randomUUID();
  
  // Build the OAuth URL with required parameters
  const params = new URLSearchParams({
    client_id: process.env.STRIPE_CLIENT_ID!,
    response_type: 'code',
    scope: 'read_write',
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/oauth/callback`,
    state,
  });
  
  const url = `https://connect.stripe.com/oauth/authorize?${params}`;
  
  // Create response with redirect and store state in a cookie
  const res = NextResponse.redirect(url);
  
  // Set cookie with the state for 10 minutes (600 seconds)
  res.cookies.set('guardian_oauth_state', state, { 
    maxAge: 600, 
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  
  return res;
} 