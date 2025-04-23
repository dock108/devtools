import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Dump all environment variables for debugging
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(Deno.env.toObject())) {
      envVars[key] = value;
    }
    console.log('All environment variables:', JSON.stringify(envVars, null, 2));
    
    const payload = await req.json();
    const email = (payload.email as string).toLowerCase();
    
    // Parse the allow list environment variable
    const envAllowList = Deno.env.get('ALPHA_ALLOW_LIST') || '';
    console.log('ALPHA_ALLOW_LIST env:', envAllowList);
    
    const allowList = envAllowList.split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    
    console.log('Parsed allow list:', allowList);
    console.log('Email to check:', email);
    console.log('Is allowed:', allowList.includes(email));
    
    // TEMPORARY: Hard-code the allow list for testing
    const hardcodedAllowList = ['alice@example.com', 'bob@company.co'];
    console.log('Hardcoded allow list:', hardcodedAllowList);
    console.log('Is allowed (hardcoded):', hardcodedAllowList.includes(email));
    
    // Check if the email is in the hardcoded allow list for testing
    if (!hardcodedAllowList.includes(email)) {
      console.warn(`Signup denied (alpha gate): ${email}`);
      return new Response(
        JSON.stringify({ 
          error: 'Signup not allowed. Please contact beta@dock108.ai for access.' 
        }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Email is allowed
    console.log(`Signup allowed for: ${email}`);
    return new Response(
      JSON.stringify({ success: true }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Function error:', err);
    return new Response(
      JSON.stringify({ error: 'Invalid request' }), 
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 