import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata = {
  title: "Connected Accounts | Dock108 Guardian",
  description: "Manage your connected Stripe accounts.",
};

export default async function AccountsPage() {
  // Get the current user
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // If not authenticated, show sign-in message
  if (!user) {
    return (
      <Container className="py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-6">
            Connected Accounts
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Please sign in to view your connected Stripe accounts.
          </p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </Container>
    );
  }
  
  // Get connected accounts for this user
  const { data: accounts } = await supabaseAdmin
    .from('connected_accounts')
    .select('*')
    .eq('user_id', user.id);
  
  return (
    <Container className="py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-6">
          Connected Accounts
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Manage your Stripe accounts connected to Guardian.
        </p>
        
        {accounts && accounts.length > 0 ? (
          <div className="bg-white rounded-lg shadow divide-y">
            {accounts.map((account) => (
              <div key={account.stripe_account_id} className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{account.stripe_account_id}</h3>
                  <p className="text-sm text-slate-500">
                    {account.live ? 'Live Mode' : 'Test Mode'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="font-medium text-lg mb-2">No accounts connected yet</h3>
            <p className="text-slate-500 mb-6">
              Connect your Stripe account to start monitoring payouts and receive alerts.
            </p>
            <Button asChild>
              <Link href="/stripe-guardian/onboard">Connect Stripe Account</Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  );
} 