import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { createOwnershipFilteredQuery, FilterableTables } from '../guards/cross-tenant';

type ProtectedClient = ReturnType<typeof createClient<Database>> & {
  secureSelect: <T extends FilterableTables>(
    table: T,
  ) => ReturnType<typeof createOwnershipFilteredQuery<T>>;
};

/**
 * Creates a Supabase client with enhanced security for server-side operations.
 *
 * This client:
 * 1. Uses the service role key to bypass RLS
 * 2. But adds programmatic enforcement of tenant isolation
 * 3. Provides a `secureSelect` method to ensure cross-tenant security
 *
 * @returns A protected Supabase client
 */
export async function createProtectedApiClient(): Promise<ProtectedClient> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  // Get the current user directly from Supabase
  const baseClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false }, // Use service key context
    },
  );

  const {
    data: { user },
    error: userError,
  } = await baseClient.auth.getUser();

  if (userError || !user) {
    throw new Error(`Unauthorized: ${userError?.message ?? 'No user found'}`);
  }

  const userId = user.id;

  // Extend the client with a secure select method
  const protectedClient = baseClient as ProtectedClient;

  protectedClient.secureSelect = <T extends FilterableTables>(table: T) => {
    return createOwnershipFilteredQuery(baseClient, table, userId);
  };

  return protectedClient;
}

/**
 * Simple wrapper that gets data from a table with tenant isolation enforced
 * @param table The table to query
 * @returns The data for the current user only
 */
export async function getProtectedData<T extends FilterableTables>(table: T) {
  const client = await createProtectedApiClient();
  const { data, error } = await client.secureSelect(table);

  if (error) {
    console.error(`Error fetching data from ${table}:`, error);
    throw new Error(`Failed to fetch data: ${error.message}`);
  }

  return data;
}
