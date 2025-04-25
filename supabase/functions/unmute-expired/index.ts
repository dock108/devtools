// supabase/functions/unmute-expired/index.ts
// Deno Deploy Edge Function to clear expired alert mutes

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@^2.42.4";

console.log("Initializing unmute-expired function");

// Required environment variables
const supabaseUrl = Deno.env.get("SUPABASE_DB_URL");
const supabaseServiceRoleKey = Deno.env.get("SERVICE_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing required environment variables: SUPABASE_DB_URL, SERVICE_KEY");
  throw new Error("Missing required environment variables for unmute function.");
}

// Initialize Supabase client with Service Role Key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  console.log(`Unmute function invoked at ${new Date().toISOString()}`);

  try {
    const { data, error, count } = await supabase
      .from('connected_accounts')
      .update({ alerts_muted_until: null })
      .lt('alerts_muted_until', 'now()') // Select rows where mute time is in the past
      .neq('alerts_muted_until', 'infinity') // Ignore indefinitely muted
      .select(); // Optionally select to get count

    if (error) {
      console.error("Error updating expired mutes:", error);
      throw error; // Throw to indicate failure
    }

    const message = `Successfully cleared ${count ?? 0} expired alert mutes.`;
    console.log(message);
    return new Response(JSON.stringify({ success: true, message, count: count ?? 0 }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Failed to run unmute process:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}); 