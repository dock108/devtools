// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { serve } from 'https://deno.land/std/http/server.ts';
import Stripe from 'npm:stripe';
import { createClient } from 'jsr:@supabase/supabase-js';

console.log(`Function "guardian-sync" up and running!`);

// Initialize Stripe client
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10', // Use your desired Stripe API version
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    // Let Supabase handle default CORS response
    return new Response('ok');
  }

  try {
    const sig = req.headers.get('stripe-signature')!;
    const body = await req.text();

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );

    // Handle only account.updated events
    if (event.type === 'account.updated') {
      console.log(`Received account.updated event for ${event.data.object.id}`);

      // Create Supabase client for calling RPC
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      // Call the RPC function
      const { error } = await supabaseClient.rpc('sync_business_account', {
        payload: event.data.object,
      });

      if (error) {
        console.error('Error calling sync_business_account RPC:', error);
        return new Response(JSON.stringify({ error: 'RPC call failed', details: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log(`Successfully called sync_business_account for ${event.data.object.id}`);
      return new Response(JSON.stringify({ status: 'ok', message: 'Sync successful' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ignore other event types
    console.log(`Ignoring event type: ${event.type}`);
    return new Response(JSON.stringify({ status: 'ignored', type: event.type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook signature verification failed or other error:', err);
    return new Response(`Webhook Error: ${err.message}`, {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/guardian-sync' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
