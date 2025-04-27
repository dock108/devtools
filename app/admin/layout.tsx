import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { Container } from '@/components/Container';
import { Database } from '@/types/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function checkAdminRole(): Promise<boolean> {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  // Check for the 'admin' role in user metadata or JWT claims
  // Adjust the path based on where you store the role (app_metadata is common)
  const isAdmin = user.app_metadata?.role === 'admin';
  // Alternative: Check custom claims if set up differently
  // const { data: { session } } = await supabase.auth.getSession();
  // const claims = session?.user?.user_metadata; // Or app_metadata based on setup
  // const isAdmin = claims?.role === 'admin';

  console.log(`Admin check for ${user.email}: isAdmin = ${isAdmin}`); // Log check result
  return isAdmin;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const isAdmin = await checkAdminRole();

  if (!isAdmin) {
    // If not admin, redirect to login or a general access denied page
    console.warn('Non-admin user attempted to access /admin area.');
    redirect('/login?error=unauthorized&redirectTo=/admin');
  }

  // If admin, render the layout and children
  return (
    <div className="flex min-h-screen flex-col">
      {/* Simple Admin Header */}
      <header className="bg-slate-800 text-white p-4">
        <Container className="flex justify-between items-center">
          <Link href="/admin" className="font-bold text-lg">
            Guardian Admin
          </Link>
          <nav className="flex gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Link href="/admin/rule-sets">Rule Sets</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Link href="/admin/settings">Notifications</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Link href="/admin/accounts">Accounts</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Link href="/">Main Site</Link>
            </Button>
            {/* Add Logout? */}
          </nav>
        </Container>
      </header>
      <main className="flex-grow bg-slate-50">
        {/* Container usually adds padding, check if needed here or within children */}
        {children}
      </main>
    </div>
  );
}
