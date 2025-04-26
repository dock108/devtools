#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import { exit } from 'process';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Print environment variable hints
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\nEnvironment variables required:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>');
  console.log('SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>');
  console.log('\nAdd these to your .env.local file (not in repo)');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Function to get the latest event from event_buffer
async function getLatestEvent() {
  const { data, error } = await supabase
    .from('event_buffer')
    .select('id, stripe_event_id, type, received_at')
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching latest event:', error);
    process.exit(1);
  }

  return data;
}

// Function to invoke the guardian-reactor Edge Function
async function invokeReactor() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get command line arguments
  const args = process.argv.slice(2);
  let eventBufferId: string | null = null;

  if (args.length > 0) {
    eventBufferId = args[0];
  } else {
    // If no event_buffer_id provided, fetch the most recent event from event_buffer
    const { data: recentEvent, error } = await supabase
      .from('event_buffer')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !recentEvent) {
      console.error('No events found in event_buffer:', error?.message);
      exit(1);
    }

    eventBufferId = recentEvent.id;
    console.log(`Using most recent event_buffer_id: ${eventBufferId}`);
  }

  // Check if the Edge Function is running locally
  const localEndpoint = 'http://localhost:54321/functions/v1/guardian-reactor';

  try {
    // Call the Edge Function
    console.log(`Invoking guardian-reactor with event_buffer_id: ${eventBufferId}`);

    const response = await fetch(localEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ event_buffer_id: eventBufferId }),
    });

    const result = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('Error invoking guardian-reactor function');
      exit(1);
    }

    console.log('Successfully invoked guardian-reactor function');
  } catch (error) {
    console.error('Error invoking guardian-reactor function:', error);
    console.error('Make sure the Supabase Edge Functions are running locally with:');
    console.error('  supabase functions serve --no-verify-jwt');
    exit(1);
  }
}

// Main function
async function main() {
  try {
    console.log('Fetching latest event from event_buffer...');
    const latestEvent = await getLatestEvent();

    if (!latestEvent) {
      console.error('No events found in event_buffer');
      process.exit(1);
    }

    console.log(`Latest event: ${latestEvent.stripe_event_id} (${latestEvent.type})`);
    console.log(`Event buffer ID: ${latestEvent.id}`);
    console.log(`Received at: ${new Date(latestEvent.received_at).toLocaleString()}`);

    console.log('\nInvoking guardian-reactor function...');
    const startTime = performance.now();
    const result = await invokeReactor();
    const duration = Math.round(performance.now() - startTime);

    console.log(`Response received in ${duration}ms`);

    // Check processed_events to see if processing was successful
    const { data: processedEvent, error } = await supabase
      .from('processed_events')
      .select('*')
      .eq('stripe_event_id', latestEvent.stripe_event_id)
      .maybeSingle();

    if (error) {
      console.error('Error checking processed_events:', error);
      return;
    }

    if (processedEvent) {
      console.log('\n✅ Event successfully processed!');
      console.log(`Processing duration: ${processedEvent.process_duration_ms}ms`);
      console.log(`Alerts created: ${processedEvent.alerts_created}`);

      if (processedEvent.alerts_created > 0) {
        // Fetch the alerts created for this event
        const { data: alerts, error: alertsError } = await supabase
          .from('alerts')
          .select('*')
          .eq('event_ref', latestEvent.stripe_event_id);

        if (alertsError) {
          console.error('Error fetching alerts:', alertsError);
        } else if (alerts && alerts.length > 0) {
          console.log('\nAlerts created:');
          alerts.forEach((alert, index) => {
            console.log(
              `[${index + 1}] ${alert.type} (${alert.severity}): ${JSON.stringify(alert.details)}`,
            );
          });
        }
      }
    } else {
      console.log('\n❌ Event processing not recorded in processed_events');
    }
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Run the main function
main();
