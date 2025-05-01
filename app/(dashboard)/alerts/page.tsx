'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AlertsDashboard() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUserAndJobs() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // Fetch jobs for this user
          const { data: jobsData, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('user_id', user.id);

          if (error) {
            console.error('Error fetching jobs:', error);
          } else {
            setJobs(jobsData || []);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    getUserAndJobs();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild variant="default">
          <Link href="/crondeck">
            <ShieldAlert className="mr-2 h-4 w-4" />
            <span>CronDeck</span>
          </Link>
        </Button>
      </header>

      <div className="bg-slate-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Welcome {user?.email}</h2>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Your Cron Jobs</h3>
          
          {loading ? (
            <p>Loading jobs...</p>
          ) : jobs.length > 0 ? (
            <div className="grid gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-slate-700 p-4 rounded-md">
                  <div className="flex justify-between">
                    <h4 className="font-medium">{job.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${job.active ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'}`}>
                      {job.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">Cron: <code>{job.cron}</code></p>
                  <p className="text-sm text-slate-300">URL: {job.script_url}</p>
                  <p className="text-sm text-slate-300">
                    Last run: {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-700 p-6 rounded-md text-center">
              <p className="mb-4">You don't have any cron jobs set up yet.</p>
              <Button>Create Your First Job</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 