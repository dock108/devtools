import { supabaseServer } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  
  if (error || !data.user) {
    return redirect('/login?next=/dashboard');
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">CronDeck Dashboard</h1>
      <p>Welcome, {data.user.email}!</p>
      <p className="mt-4 italic">Job list coming soon…</p>
    </main>
  );
} 