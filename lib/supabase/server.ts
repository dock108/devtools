import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  // NOTE: We only need 'get' here because this is for reading data in a Server Component.
  // Server Actions would require 'set' and 'remove'.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore.get(name);
          return cookie?.value;
        },
      },
    },
  );
}
