import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.schema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Reuse across hot reloads in dev
const globalForSupabase = global as unknown as {
  supabaseClient?: ReturnType<typeof createClient>;
};

// Create Supabase client for browser-side use
// This client will respect RLS policies
export const supabaseClient = globalForSupabase.supabaseClient || 
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public', // Explicitly use public schema to ensure RLS rules apply
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseClient = supabaseClient;
} 