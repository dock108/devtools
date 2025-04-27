import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { z } from 'zod';

// Helper function to check admin role (can be shared/imported)
async function checkAdmin(
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>,
): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  return !userError && !!user && user.app_metadata?.role === 'admin';
}

// Zod schema for updating account's rule set
const updateAccountSchema = z.object({
  rule_set_id: z.string().uuid({ message: 'Invalid Rule Set ID.' }).nullable(), // Allow setting to null
});

// GET: Fetch all accounts with their assigned rule set names
export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch accounts and join with rule_sets to get the name
    // Adjust column names ('stripe_account_id', 'account_name', 'status') as per your actual schema
    const { data, error } = await supabase
      .from('accounts')
      .select(
        `
        id, 
        stripe_account_id, 
        account_name, 
        status, 
        created_at, 
        rule_set_id,
        rule_sets ( name )
      `,
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Process data to flatten the rule set name
    const processedData = data.map((account) => ({
      ...account,
      rule_set_name: account.rule_sets?.name || 'Default', // Show 'Default' or similar if null/no rule set
      rule_sets: undefined, // Remove the nested object
    }));

    return NextResponse.json(processedData);
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error.message },
      { status: 500 },
    );
  }
}

// PATCH: Update the rule_set_id for a specific account
export async function PATCH(request: Request, { params }: { params: { accountId?: string } }) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get account ID from URL path (e.g., /api/admin/accounts/[accountId])
  // This requires the route file to be named `app/api/admin/accounts/[accountId]/route.ts`
  // OR extract from query/body if not using dynamic route segments.
  // For simplicity, let's assume it comes in the request body for now, similar to PUT.
  // Revisit this if using dynamic route segments.

  // Let's expect the account ID in the URL search params like /api/admin/accounts?id=xxx
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('id');

  if (!accountId || !z.string().uuid().safeParse(accountId).success) {
    return NextResponse.json(
      { error: 'Valid Account ID is required in query parameters' },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const validation = updateAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { rule_set_id } = validation.data;

    // If rule_set_id is provided, verify it exists before assigning
    if (rule_set_id) {
      const { data: ruleSetExists, error: ruleSetError } = await supabase
        .from('rule_sets')
        .select('id')
        .eq('id', rule_set_id)
        .maybeSingle();

      if (ruleSetError) throw ruleSetError;
      if (!ruleSetExists) {
        return NextResponse.json(
          { error: 'Specified Rule Set ID does not exist.' },
          { status: 404 },
        );
      }
    }

    // Update the account
    const { data, error } = await supabase
      .from('accounts')
      .update({ rule_set_id: rule_set_id })
      .eq('id', accountId)
      .select('id, rule_set_id') // Select updated fields
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating account rule set:', error);
    return NextResponse.json(
      { error: 'Failed to update account rule set', details: error.message },
      { status: 500 },
    );
  }
}
