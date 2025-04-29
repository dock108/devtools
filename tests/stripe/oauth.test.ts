import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Mock dependencies
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: jest.fn(),
  },
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('stripe', () => jest.fn());

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      getUser: jest.fn(),
    },
  }),
}));

// Mock environment variables
process.env.STRIPE_CLIENT_ID = 'ca_test123';
process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';

// Re-enable test suite
describe('Stripe OAuth Flow', () => {
  let mockCookieStore: any;
  let mockStripeInstance: any;

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup cookie mock
    mockCookieStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    (cookies as jest.Mock).mockReturnValue(mockCookieStore);

    // Setup Stripe mock
    mockStripeInstance = {
      oauth: {
        token: jest.fn(),
      },
    };

    (Stripe as unknown as jest.Mock).mockReturnValue(mockStripeInstance);
  });

  describe('OAuth Start Route', () => {
    it('should generate a state and redirect to Stripe with correct params', async () => {
      // Arrange
      const mockUUID = 'mock-uuid-value';
      (crypto.randomUUID as jest.Mock).mockReturnValue(mockUUID);

      const mockRedirectResponse = { cookies: { set: jest.fn() } };
      (NextResponse.redirect as jest.Mock).mockReturnValue(mockRedirectResponse);

      // Import the handler function
      const { GET } = await import('@/app/api/stripe/oauth/start/route');

      // Act
      await GET();

      // Assert
      expect(crypto.randomUUID).toHaveBeenCalled();

      // Verify redirect URL contains expected params
      const expectedUrl = `https://connect.stripe.com/oauth/authorize?client_id=ca_test123&response_type=code&scope=read_write&redirect_uri=https%3A%2F%2Ftest.example.com%2Fapi%2Fstripe%2Foauth%2Fcallback&state=${mockUUID}`;
      expect(NextResponse.redirect).toHaveBeenCalledWith(expectedUrl);

      // Verify cookie was set with state
      expect(mockRedirectResponse.cookies.set).toHaveBeenCalledWith(
        'guardian_oauth_state',
        mockUUID,
        expect.objectContaining({
          maxAge: 600,
          httpOnly: true,
        }),
      );
    });
  });

  describe('OAuth Callback Route', () => {
    it('should return 400 if state does not match', async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: 'stored-state' });

      const mockRequest = new Request(
        'https://test.example.com/api/stripe/oauth/callback?code=test_code&state=different-state',
      );

      // Import the handler function
      const { GET } = await import('@/app/api/stripe/oauth/callback/route');

      // Act
      const response = await GET(mockRequest);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should store tokens in database when OAuth flow is successful', async () => {
      // Arrange
      const mockState = 'test-state';
      const mockCode = 'test_code';
      mockCookieStore.get.mockReturnValue({ value: mockState });

      const mockTokenResponse = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        stripe_user_id: 'acct_test123',
        livemode: false,
      };

      mockStripeInstance.oauth.token.mockResolvedValue(mockTokenResponse);

      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockSupabaseClient = require('@/utils/supabase/server').createClient();
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

      const mockRequest = new Request(
        `https://test.example.com/api/stripe/oauth/callback?code=${mockCode}&state=${mockState}`,
      );

      // Import the handler function
      const { GET } = await import('@/app/api/stripe/oauth/callback/route');

      // Act
      const response = await GET(mockRequest);

      // Assert
      expect(mockStripeInstance.oauth.token).toHaveBeenCalledWith({
        grant_type: 'authorization_code',
        code: mockCode,
      });

      // Verify tokens stored in database
      expect(supabaseAdmin.from).toHaveBeenCalledWith('connected_accounts');
      expect(supabaseAdmin.upsert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        stripe_account_id: mockTokenResponse.stripe_user_id,
        access_token: mockTokenResponse.access_token,
        refresh_token: mockTokenResponse.refresh_token,
        live: mockTokenResponse.livemode,
      });

      // Verify alert_channels created
      expect(supabaseAdmin.from).toHaveBeenCalledWith('alert_channels');
      expect(supabaseAdmin.upsert).toHaveBeenCalledWith({
        stripe_account_id: mockTokenResponse.stripe_user_id,
        email_to: mockUser.email,
      });

      // Verify state cookie was cleared
      expect(mockCookieStore.delete).toHaveBeenCalledWith('guardian_oauth_state');

      // Verify successful response
      expect(response.status).toBe(200);
    });
  });
});
