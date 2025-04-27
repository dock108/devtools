import { NextRequest, NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase.d';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alertId = params.id;
    const { resolved } = await request.json();

    // Get the user session
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // First, get the alert to verify ownership
    const { data: alert, error: fetchError } = await supabase
      .from('alerts')
      .select('*, account:stripe_account_id')
      .eq('id', alertId)
      .single();

    if (fetchError || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Get user's connected accounts to verify ownership
    const { data: userAccounts, error: accountsError } = await supabase
      .from('connected_accounts')
      .select('stripe_account_id')
      .eq('user_id', userId);

    if (accountsError) {
      return NextResponse.json({ error: 'Failed to verify account ownership' }, { status: 500 });
    }

    // Check if this alert belongs to one of the user's accounts
    const userAccountIds = userAccounts.map((account) => account.stripe_account_id);
    if (!userAccountIds.includes(alert.stripe_account_id)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this alert' },
        { status: 403 },
      );
    }

    // Update the alert
    const { data, error: updateError } = await supabase
      .from('alerts')
      .update({ resolved })
      .eq('id', alertId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
