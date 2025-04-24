import { useEffect, useState } from 'react';
// Remove direct client creation import
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@supabase/supabase-js';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'; // Import the singleton client

export function useSession() {
  // const supabase = useSupabase(); // No longer needed from context
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session using the singleton client
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };
    
    initSession();

    // Set up auth state listener using the singleton client
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Clean up subscription
    return () => {
      subscription.unsubscribe();
    };
  // No dependency on supabase instance needed as it's a stable singleton import
  }, []); 

  return { session, loading };
} 