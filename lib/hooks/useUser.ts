import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// Define a type for profile data
type Profile = {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  updated_at?: string;
};

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const getUser = async () => {
      try {
        setIsLoading(true);

        // Get current session and user
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setUser(null);
          setProfile(null);
          return;
        }

        // Set the user from the session
        setUser(session.user);

        // Fetch profile data if available
        if (session.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 is the error code for "no rows returned"
            console.error('Error fetching profile:', profileError);
            setError(new Error(`Error fetching profile: ${profileError.message}`));
          }

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (err) {
        console.error('Error in useUser hook:', err);
        setError(err instanceof Error ? err : new Error('Unknown error in useUser hook'));
      } finally {
        setIsLoading(false);
      }
    };

    // Get initial user
    getUser();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        // Refresh profile data on auth change
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, profile, isLoading, error };
}
