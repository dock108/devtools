import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Resend } from 'npm:resend';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or restrict to your Supabase project URL
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email templates (basic HTML)
const templates = {
  guardian: {
    subject: 'Welcome to the Stripe Guardian Waitlist!',
    body: (email: string) => `
      <html>
        <body>
          <p>Hi there,</p>
          <p>Thanks for joining the waitlist for <strong>Stripe Guardian</strong>!</p>
          <p>We're hard at work building the best fraud protection for Stripe Connect platforms.</p>
          <p>We'll keep you updated on our progress.</p>
          <p>Best,</p>
          <p>The DOCK108 Team</p>
        </body>
      </html>
    `,
  },
  notary: {
    subject: 'Welcome to the Notary CI Waitlist!',
    body: (email: string) => `
      <html>
        <body>
          <p>Hi there,</p>
          <p>Thanks for joining the waitlist for <strong>Notary CI</strong>!</p>
          <p>Get ready for hassle-free macOS codesigning and notarization, right from your CI pipeline.</p>
          <p>We'll keep you updated on our progress.</p>
          <p>Best,</p>
          <p>The DOCK108 Team</p>
        </body>
      </html>
    `,
  },
  crondeck: {
    subject: 'Welcome to the CronDeck Waitlist!',
    body: (email: string) => `
      <html>
        <body>
          <p>Hi there,</p>
          <p>Thanks for joining the waitlist for <strong>CronDeck</strong>!</p>
          <p>Say goodbye to silent cron failures! Unified monitoring is coming soon.</p>
          <p>We'll keep you updated on our progress.</p>
          <p>Best,</p>
          <p>The DOCK108 Team</p>
        </body>
      </html>
    `,
  },
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, product } = await req.json();

    if (!email || !product || !templates[product as keyof typeof templates]) {
      return new Response(JSON.stringify({ error: 'Missing email or invalid product' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');

    if (!resendApiKey || !fromEmail) {
      console.error('Missing RESEND_API_KEY or FROM_EMAIL environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    const template = templates[product as keyof typeof templates];

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: template.subject,
      html: template.body(email),
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log(`Welcome email sent successfully to ${email} for ${product}`, data);
    return new Response(JSON.stringify({ success: true, messageId: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
