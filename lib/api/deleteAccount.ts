import { createClient } from '@/utils/supabase/client'; // Assuming this is the correct path

export async function deleteAccount(stripeAccountId: string) {
  const supabase = createClient();
  // Ensure the RPC function name and parameter name match the SQL definition
  const { data, error } = await supabase.rpc('delete_account', { p_account_id: stripeAccountId });

  if (error) {
    console.error('Error calling delete_account RPC:', error);
  }

  return { data, error };
}
