import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend';

// CORS headers (less critical for cron, but good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Placeholder for weekly progress updates - replace with dynamic content later
const weeklyUpdateContent = `
  <p>Here's a quick update on what we shipped for DOCK108 tools last week:</p>
  <ul>
    <li>Launched the initial product pages for Stripe Guardian, Notary CI, and CronDeck.</li>
    <li>Set up automated welcome emails for new waitlist signups.</li>
    <li>Started work on the core API for Stripe Guardian fraud rules.</li>
  </ul>
  <p>More updates next week!</p>
`;

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); // Use non-public URL if needed
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey || !fromEmail) {
      console.error('Missing environment variables for Supabase/Resend');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Fetch emails from all lead tables added in the last 7 days
    const tables = ['guardian_leads', 'notary_leads', 'crondeck_leads'];
    let allNewEmails: string[] = [];

    for (const table of tables) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('email')
        .gt('created_at', sevenDaysAgoISO);

      if (error) {
        console.error(`Error fetching emails from ${table}:`, error);
        // Decide if you want to continue or fail the whole job
        continue; // Skip this table on error
      }
      if (data) {
        allNewEmails = allNewEmails.concat(data.map((row) => row.email));
      }
    }

    // Deduplicate emails
    const uniqueNewEmails = [...new Set(allNewEmails)];

    if (uniqueNewEmails.length === 0) {
      console.log('No new leads in the past 7 days. No digest sent.');
      return new Response(JSON.stringify({ success: true, message: 'No new leads' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compose the digest email
    const subject = 'DOCK108 Weekly Progress Update';
    const body = `
      <html>
        <body>
          <h2>DOCK108 Update</h2>
          ${weeklyUpdateContent}
          <p>Thanks for being on the waitlist!</p>
          <p>The DOCK108 Team</p>
        </body>
      </html>
    `;

    // Send the email using Resend (consider batching for large lists)
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      // BCC is better for privacy if sending one email to many
      bcc: uniqueNewEmails,
      subject: subject,
      html: body,
    });

    if (error) {
      console.error('Resend error sending digest:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send digest email', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log(`Weekly digest sent successfully to ${uniqueNewEmails.length} recipients.`, data);
    return new Response(
      JSON.stringify({ success: true, recipients: uniqueNewEmails.length, messageId: data?.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
