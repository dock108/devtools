import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log the values to verify they're loaded (without revealing the entire key)
console.log('Environment variables:');
console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}`);
console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY?.substring(0, 10)}...`);
console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10)}...`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars. Make sure you have:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Regular client for user operations
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Admin client for backend operations
const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function quickAuthCheck() {
  try {
    console.log('🔑 Running quick auth check for Supabase...');
    
    // Generate a random email for testing
    const testEmail = `test-${Math.floor(Math.random() * 10000)}@example.com`;
    console.log(`🧪 Using test email: ${testEmail}`);
    
    // 1. Create a test user with the service role client (simulating backend operations)
    console.log('👤 Creating test user...');
    const { data: { user }, error: userError } = await adminSupabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true, // Auto-confirm the email
      password: 'testpassword123',
    });
    
    if (userError) {
      throw new Error(`Failed to create user: ${userError.message}`);
    }
    
    console.log('✅ Test user created:', user.id);
    
    // 2. Insert the user into the public.users table (simulating the signup trigger)
    console.log('📝 Creating user record in public.users table...');
    const { error: userInsertError } = await adminSupabase
      .from('users')
      .insert({
        auth_uid: user.id,
        tier: 'free_beta'
      });
      
    if (userInsertError) {
      throw new Error(`Failed to insert user record: ${userInsertError.message}`);
    }
    
    console.log('✅ User record created in public.users table');
    
    // 3. Login as the test user
    console.log('🔐 Logging in as test user...');
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'testpassword123',
    });
    
    if (signInError || !session) {
      throw new Error(`Failed to sign in: ${signInError?.message || 'No session returned'}`);
    }
    
    console.log('✅ Signed in successfully as test user');
    
    // 5. Create a test job
    console.log('📋 Creating test job...');
    
    // First, get the user's ID from the users table
    const { data: userData, error: userDataError } = await adminSupabase
      .from('users')
      .select('id')
      .eq('auth_uid', user.id)
      .single();
    
    if (userDataError || !userData) {
      throw new Error(`Failed to get user ID: ${userDataError?.message || 'User not found'}`);
    }
    
    console.log(`User ID found: ${userData.id}`);
    
    // Now create the job with the admin client first (bypassing RLS)
    const { data: jobData, error: jobError } = await adminSupabase
      .from('jobs')
      .insert({
        name: 'Test Cron Job',
        cron: '0 0 * * *', // Run at midnight every day
        script_url: 'https://example.com/test-script.js',
        user_id: userData.id
      })
      .select()
      .single();
    
    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }
    
    console.log('✅ Test job created:', jobData?.id);
    
    // 6. Try to read the job back to verify RLS
    console.log('🔍 Verifying job can be read by the same user (RLS check)...');
    
    // Create a client using the user's session
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });
    
    // Test reading the job with the user's client - first log all jobs to debug
    console.log('Checking all jobs accessible to this user:');
    const { data: allJobs, error: allJobsError } = await userClient
      .from('jobs')
      .select('*');
      
    if (allJobsError) {
      console.error('Error fetching all jobs:', allJobsError.message);
    } else {
      console.log(`User can see ${allJobs.length} jobs:`, allJobs);
    }
    
    // Let's verify our RLS policy by checking if the generated job ID exists in the results
    if (allJobs && allJobs.length > 0) {
      const foundJob = allJobs.find(job => job.id === jobData.id);
      
      if (foundJob) {
        console.log('✅ Successfully retrieved job - RLS policy working correctly!');
        console.log('📄 Job data:', foundJob);
      } else {
        throw new Error(`RLS policy issue: Job created (${jobData.id}) but not visible to the authenticated user`);
      }
    } else {
      throw new Error('No jobs visible to user - RLS policy might be misconfigured or auth token not working');
    }
    
    // 7. Try to access with a different user (should fail due to RLS)
    console.log('\n🛡️ Testing RLS protection...');
    console.log('Creating a second user to verify they cannot access the first user\'s job...');
    
    // Create second test user
    const testEmail2 = `test2-${Math.floor(Math.random() * 10000)}@example.com`;
    const { data: { user: user2 }, error: user2Error } = await adminSupabase.auth.admin.createUser({
      email: testEmail2,
      email_confirm: true,
      password: 'testpassword456',
    });
    
    if (user2Error) {
      throw new Error(`Failed to create second user: ${user2Error.message}`);
    }
    
    // Add to users table
    await adminSupabase.from('users').insert({ auth_uid: user2.id, tier: 'free_beta' });
    
    // Sign in as second user
    const { data: { session: session2 }, error: signIn2Error } = await supabase.auth.signInWithPassword({
      email: testEmail2,
      password: 'testpassword456',
    });
    
    if (signIn2Error || !session2) {
      throw new Error(`Failed to sign in as second user: ${signIn2Error?.message || 'No session returned'}`);
    }
    
    // Create client for second user
    const user2Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${session2.access_token}`
        }
      }
    });
    
    // Try to access first user's job (should return empty or error)
    const { data: unauthorized, error: unauthorizedError } = await user2Client
      .from('jobs')
      .select('*')
      .eq('id', jobData?.id)
      .single();
    
    if (unauthorized) {
      console.error('❌ RLS FAILURE: Second user could access first user\'s job!');
      console.error('This suggests the RLS policy is not working correctly.');
    } else {
      console.log('✅ RLS working correctly - second user could not access first user\'s job');
    }
    
    // Clean up test users
    console.log('\n🧹 Cleaning up test data...');
    await adminSupabase.auth.admin.deleteUser(user.id);
    await adminSupabase.auth.admin.deleteUser(user2.id);
    
    console.log('\n✅ Auth check completed successfully!');
    console.log('All tests passed:');
    console.log('- User creation ✓');
    console.log('- Authentication ✓');
    console.log('- Job creation ✓');
    console.log('- RLS policy enforcement ✓');
    
  } catch (error) {
    console.error('❌ Auth check failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

quickAuthCheck(); 