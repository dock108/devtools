---
title: Guardian Local Development
description: Setting up your local environment for developing Stripe Guardian features.
---

# Guardian Local Development

This guide covers setting up your local environment for Stripe Guardian development,
particularly the Stripe Connect OAuth flow and webhook handling.

## Environment Variables

Create a `.env.local` file in the project root with the following variables (copy from `.env.example`):

```bash
# ---- Stripe Platform ----
STRIPE_CLIENT_ID=ca_XXXXXXXXXXXXXXXX
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX  # used by platform-level /api/stripe/webhook

# ---- Supabase ----
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key

# ---- Guardian Alpha Access ----
ALPHA_ALLOW_LIST=alice@example.com,bob@company.co

# ---- Resend ----
RESEND_API_KEY=re_test_XXXXXXXXXXXXXXXX

# ---- Site ----
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Local Stripe Connect OAuth

To test the Stripe Connect OAuth flow locally:

1. **Register your platform in Stripe**

   - Sign in to the [Stripe Dashboard](https://dashboard.stripe.com)
   - Navigate to **Connect** → **Settings** → **Connect settings**
   - Click **Register platform** if not already registered
   - Copy the `client_id` value and add it to your `.env.local` file as `STRIPE_CLIENT_ID`

2. **Configure OAuth Redirect URI**

   - In the same Stripe Connect settings page, add `http://localhost:3000/api/stripe/oauth/callback` as a Redirect URI
   - Save the changes

3. **Set up local webhook forwarding**

   - Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
   - Run `stripe login` to authenticate
   - Start webhook forwarding:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   - Copy the webhook signing secret that is displayed and add it to your `.env.local` file as `STRIPE_WEBHOOK_SECRET`

4. **Start your development server**

   ```bash
   npm run dev
   ```

5. **Test the OAuth flow**
   - Navigate to `/stripe-guardian/onboard` in your browser
   - Click "Connect my Stripe account"
   - You should be redirected to Stripe's OAuth page
   - Authenticate with a Stripe test account
   - You should be redirected back to your local app at `/stripe-guardian/settings/accounts`
   - Verify that the account appears in the Connected Accounts list

## Webhook Handling

The webhook setup handles two types of webhook events:

1. **Platform-level webhooks** using `STRIPE_WEBHOOK_SECRET`
2. **Connected account webhooks** using per-account webhook secrets stored in the database

When a webhook is received:

1. The webhook handler (`/api/stripe/webhook`) checks if it's from a connected account (via the `stripe-account` header)
2. If it is, it looks up the webhook secret for that account from the database
3. It verifies the signature using the appropriate secret
4. It processes the event and stores it in the database

## Webhook Secret Rotation

After connecting an account, the app automatically creates a webhook endpoint on that account
that points to your platform's webhook endpoint. The webhook secret is stored in the database.

If needed, you can rotate a webhook secret through:

1. The Settings UI - navigate to `/stripe-guardian/settings/accounts` where connected accounts are listed
2. Through the API directly by making a POST request to `/api/accounts/:acct/webhook/rotate`

When the secret is rotated:

1. Existing webhooks on the account are deleted
2. A new webhook endpoint is created with fresh secret
3. The new secret is stored in the database

## Troubleshooting

### OAuth Errors

- **"Bad OAuth state" error**: Make sure your browser accepts cookies from localhost
- **"Invalid client_id" error**: Verify your `STRIPE_CLIENT_ID` is correct and that your platform is properly registered
- **"Invalid redirect_uri" error**: Check that you've added the correct redirect URI in the Stripe Connect settings

### Webhook Errors

- **"Signature verification failed" error**: Ensure your webhook secret is correct and that the Stripe CLI is forwarding events
- If events aren't being received, check that the Stripe CLI is running and forwarding to the correct URL

### Database Errors

- Verify that your Supabase connection is working
- Check that the necessary tables exist in your database
