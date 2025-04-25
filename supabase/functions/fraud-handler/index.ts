// deno run --allow-env --allow-net supabase/functions/fraud-handler/index.ts
import Stripe from "https://esm.sh/stripe@^15.0"; // Use specific or latest compatible version
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@^2.42.4";
import { Resend } from "https://esm.sh/resend@^3.0"; // Add Resend import

// Ensure required environment variables are set
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_DB_URL");
const supabaseServiceRoleKey = Deno.env.get("SERVICE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

const missingVars = [
  !stripeSecretKey && "STRIPE_SECRET_KEY",
  !supabaseUrl && "SUPABASE_DB_URL",
  !supabaseServiceRoleKey && "SERVICE_KEY",
  !resendApiKey && "RESEND_API_KEY",
  !slackWebhookUrl && "SLACK_WEBHOOK_URL",
].filter(Boolean).join(", ");

if (missingVars) {
  console.error(`Missing required environment variables: ${missingVars}`);
  // Function cannot proceed without these
  throw new Error(`Missing required environment variables: ${missingVars}`);
}

// Initialize clients (only if keys exist)
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-04-10", // Use your target API version
      httpClient: Stripe.createFetchHttpClient(), // Required for Deno
    })
  : null;

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }, // No need to persist session for service role
    })
  : null;

const resend = new Resend(resendApiKey!);

console.log("Fraud Handler function initialized with all clients.");

// --- Helper: Send Slack Notification ---
async function sendSlackNotification(message: string) {
  if (!slackWebhookUrl) return; // Already checked above, but safe guard
  try {
    console.log("Sending Slack notification...");
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
    }
    console.log("Slack notification sent successfully.");
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    // Decide if this should be fatal for the function call
    throw error; // Re-throw to cause 500 as per spec
  }
}

// --- Helper: Send Email Notification ---
async function sendEmailNotification(to: string, subject: string, body: string) {
  if (!resendApiKey) return; // Already checked
  try {
    console.log(`Sending email notification to ${to}...`);
    const { data, error } = await resend.emails.send({
      from: "DOCK108 Guardian <guardian@dock108.ai>", // Replace with your verified sender
      to: [to],
      subject: subject,
      text: body, // Or use `html` for HTML emails
    });

    if (error) {
      throw error; // Let Resend error propagate
    }
    console.log(`Email notification sent successfully to ${to}. ID:`, data?.id);
  } catch (error) {
    console.error(`Error sending email notification to ${to}:`, error);
    throw error; // Re-throw to cause 500
  }
}

serve(async (req) => {
  // Immediately return if clients couldn't be initialized
  if (!stripe || !supabase) {
    console.error("Stripe or Supabase client not initialized due to missing env vars.");
    return new Response("Internal Server Configuration Error", { status: 500 });
  }

  if (req.method !== "POST") {
    console.log(`Received ${req.method}, expected POST.`);
    return new Response("Method Not Allowed", { status: 405 });
  }

  let accountId: string | undefined;
  let accountDetails: { business_name: string | null; email_to: string | null } | null = null;

  try {
    const body = await req.json();
    accountId = body?.accountId;

    if (!accountId || typeof accountId !== 'string') {
      console.log("Request body missing or invalid accountId:", body);
      return new Response(JSON.stringify({ error: "Missing or invalid accountId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Processing fraud alert for account: ${accountId}`);

    // --- Fetch Account Details for Notifications ---
    // We need the email and potentially the business name
    // Assuming email is stored in alert_channels
    console.log(`Fetching notification details for account: ${accountId}`);
    const { data: channelInfo, error: channelError } = await supabase
      .from('alert_channels') // Query alert_channels for email
      .select('email_to')
      .eq('stripe_account_id', accountId!)
      .maybeSingle();

    if (channelError) {
      console.error(`Error fetching alert channel details for ${accountId}:`, channelError);
      throw new Error(`Failed to fetch notification details: ${channelError.message}`);
    }
    if (!channelInfo?.email_to) {
        // Maybe fetch user email from connected_accounts or auth user as fallback?
        // For now, error if no email destination found.
        console.error(`No email destination found in alert_channels for ${accountId}`);
        throw new Error(`Notification email destination not configured for account ${accountId}`);
    }

    // Optionally fetch business name from connected_accounts if needed
    const { data: accountInfo, error: accountError } = await supabase
        .from('connected_accounts')
        .select('business_name')
        .eq('stripe_account_id', accountId!)
        .maybeSingle();
    
    if (accountError) {
        console.warn(`Could not fetch business name for ${accountId}:`, accountError); 
        // Non-fatal, continue without business name if needed
    }

    accountDetails = {
        business_name: accountInfo?.business_name || accountId, // Fallback to accountId if name missing
        email_to: channelInfo.email_to
    };
    console.log(`Notification details fetched for ${accountId}:`, { email: accountDetails.email_to, name: accountDetails.business_name });

    // 1. Pause payouts in Stripe
    console.log(`Attempting to pause payouts via Stripe for ${accountId}...`);
    const stripeUpdateResult = await stripe.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
    console.log(`Stripe payouts paused successfully for ${accountId}.`, stripeUpdateResult.id);

    // 2. Update DB
    console.log(`Attempting to update DB for ${accountId}...`);
    const { error: dbError } = await supabase
      .from("connected_accounts")
      .update({
        payouts_paused: true,
        paused_by: "system",
        paused_reason: "fraud_detected", // Use consistent reason
      })
      .eq("stripe_account_id", accountId);

    if (dbError) {
      console.error(`Database update failed for ${accountId}:`, dbError);
      // Consider if you should try to revert the Stripe change here? Potentially complex.
      throw new Error(`Database update failed: ${dbError.message}`);
    }
    console.log(`Database updated successfully for ${accountId}.`);

    // 3. Trigger Notifications
    const accountDisplayName = accountDetails.business_name || accountId;
    const dashboardLink = `${Deno.env.get("NEXT_PUBLIC_APP_URL") || 'https://www.dock108.ai'}/settings/connected-accounts`; // Construct dashboard link
    const subject = `🚨 Payouts Paused – Possible Fraud for ${accountDisplayName}`;
    const messageBody = `⚠️ Payouts have been automatically suspended for Stripe account ${accountDisplayName} (${accountId}) after a possible fraud event was detected.\n\nPlease review recent activity and re-enable payouts in your DOCK108 dashboard once confirmed legitimate:\n${dashboardLink}`;
    
    // Send concurrently (or sequentially if preferred)
    await Promise.all([
      sendEmailNotification(accountDetails.email_to!, subject, messageBody),
      sendSlackNotification(`🚨 Payouts Paused: Account ${accountDisplayName} (${accountId}). Review required: ${dashboardLink}`)
    ]);

    // 4. Respond OK
    console.log(`Successfully processed fraud alert for ${accountId}.`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error(`Error processing fraud alert for account ${accountId || 'unknown'}:`, err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal Server Error", details: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}); 