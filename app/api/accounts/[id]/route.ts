import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase';
import { createAdminClient } from '@/lib/supabase/admin'; // Use admin for updates?
import { z } from 'zod';

// Placeholder for pausing rules/notifications
async function pauseAccountMonitoring(accountId: string) {
  console.warn(`TODO: Implement pauseAccountMonitoring for ${accountId}`);
  // This function would interact with your rule engine or notification system
  // to stop processing/alerting for the disconnected account.
}

// Schema to validate the PATCH request body
const updateSchema = z.object({
  rule_set_id: z.string().uuid().nullable(), // Allow null to set back to default
});

// Helper function to check user role (Replace with your actual implementation)
async function checkUserRole(userId: string, role: string): Promise<boolean> {
  console.warn(`TODO: Implement checkUserRole for user ${userId}, role ${role}. Returning false.`);
  // Example using raw_app_meta_data:
  // const supabaseAdmin = createAdminClient();
  // const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  // if (error) return false;
  // return data.user?.user_metadata?.role === role;
  return false; // Placeholder
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const accountId = params.id; // This is the Stripe Account ID (e.g., acct_...)

  // Basic validation
  if (!accountId || !accountId.startsWith('acct_')) {
    return NextResponse.json({ error: 'Invalid account ID format.' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use Admin client to update status, RLS might block user update
    const supabaseAdmin = createAdminClient();

    // Update the status in the database
    // We select 'id' to check if the update affected any row owned by the user
    // Note: RLS on SELECT applies even when using admin client if not bypassed?
    // Alternative: check ownership before update.
    const { data, error: updateError } = await supabaseAdmin
      .from('stripe_accounts')
      .update({ status: 'disconnected' })
      .eq('stripe_account_id', accountId)
      .eq('user_id', user.id) // Ensure user owns this account before updating
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error(`Error disconnecting account ${accountId}:`, updateError);
      return NextResponse.json({ error: 'Failed to disconnect account.' }, { status: 500 });
    }

    if (!data) {
      // This means no row was found matching the accountId AND userId
      return NextResponse.json(
        { error: 'Account not found or permission denied.' },
        { status: 404 },
      );
    }

    // Successfully marked as disconnected, now pause monitoring
    await pauseAccountMonitoring(accountId);

    return NextResponse.json({ message: 'Account disconnected successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error(`Unexpected error disconnecting ${accountId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const accountId = params.id; // Stripe Account ID

  // Basic validation
  if (!accountId || !accountId.startsWith('acct_')) {
    return NextResponse.json({ error: 'Invalid account ID format.' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Authorization: Check if user has 'admin' role
    const isAdmin = await checkUserRole(user.id, 'admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Requires admin role.' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = updateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 },
      );
    }

    const { rule_set_id } = validationResult.data;

    // Use Admin client to perform the update
    const supabaseAdmin = createAdminClient();

    // Update the rule_set_id
    const { error: updateError } = await supabaseAdmin
      .from('stripe_accounts')
      .update({ rule_set_id: rule_set_id })
      .eq('stripe_account_id', accountId);
    // No user_id check here as admin can update any account

    if (updateError) {
      // Handle specific errors like foreign key violation if rule_set_id doesn't exist
      if (updateError.code === '23503') {
        // foreign_key_violation
        return NextResponse.json({ error: 'Invalid rule_set_id provided.' }, { status: 400 });
      }
      console.error(`Error updating rule_set_id for ${accountId}:`, updateError);
      return NextResponse.json({ error: 'Failed to update rule set.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Rule set updated successfully.' }, { status: 200 });
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      // Handle JSON parsing error
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.error(`Unexpected error updating ${accountId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
