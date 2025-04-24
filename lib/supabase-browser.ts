import { createBrowserClient } from '@supabase/ssr';

// Create a singleton Supabase client for browser-side usage
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
); 