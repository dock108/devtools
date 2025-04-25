import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.schema';
import crypto from 'crypto';

// Helper to create a server-side Supabase client
function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
            // Can't set cookies in Server Actions/Components directly yet in this setup
            // Client will need to handle session refresh if needed after updates
        },
        remove(name: string, options) {
             // Can't set cookies in Server Actions/Components directly yet in this setup
        }
      },
    }
  );
}

export interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    theme: string | null;
    api_keys: ApiKeyInfo[]; // Assuming array of objects
    created_at: string | null;
}

export interface ApiKeyInfo {
    id: string; // UUID for the key entry
    name: string;
    prefix: string; // e.g., 'dk_'
    created_at: string;
    last_used_at?: string | null;
}

// --- Profile Functions --- 

export async function getProfile(): Promise<Profile | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error || !data) {
        console.error('Error fetching profile:', error?.message);
        // Optionally create profile if it doesn't exist (should be handled by trigger ideally)
        return null;
    }
    
    // Ensure api_keys is always an array
    const profileData = { ...data, api_keys: Array.isArray(data.api_keys) ? data.api_keys : [] };

    return profileData as Profile;
}

export async function updateProfile(updates: { display_name?: string; avatar_url?: string; theme?: string }): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
     const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'User not authenticated' };

    // Validate inputs (basic example)
    if (updates.display_name && updates.display_name.length > 50) {
        return { success: false, error: 'Display name cannot exceed 50 characters.' };
    }
    if (updates.avatar_url) {
        try {
            new URL(updates.avatar_url);
        } catch (_) {
            return { success: false, error: 'Invalid Avatar URL.' };
        }
    }
    if (updates.theme && !['system', 'light', 'dark'].includes(updates.theme)) {
         return { success: false, error: 'Invalid theme value.' };
    }

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

    if (error) {
        console.error('Error updating profile:', error.message);
        return { success: false, error: error.message };
    }
    return { success: true };
}

// --- Password Function --- 

export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    // Password updates are handled directly via auth
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
        console.error('Error updating password:', error.message);
        return { success: false, error: error.message };
    }
    return { success: true };
}

// --- API Key Functions --- 

const API_KEY_PREFIX = 'dk_';
const API_KEY_LENGTH = 32; // Length of the random part

export async function generateApiKey(name: string): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'User not authenticated' };

    if (!name || name.trim().length === 0) {
        return { success: false, error: 'API key name cannot be empty.' };
    }

    const randomBytes = crypto.randomBytes(API_KEY_LENGTH).toString('hex');
    const fullApiKey = `${API_KEY_PREFIX}${randomBytes}`;
    const keyId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const newKeyInfo: ApiKeyInfo = {
        id: keyId,
        name: name.trim(),
        prefix: API_KEY_PREFIX,
        created_at: createdAt,
    };

    // Fetch current keys
    const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('api_keys')
        .eq('id', user.id)
        .single();

    if (fetchError || !profileData) {
        console.error('Error fetching profile for API key generation:', fetchError?.message);
        return { success: false, error: 'Could not load profile data.' };
    }

    const currentKeys = Array.isArray(profileData.api_keys) ? profileData.api_keys : [];
    const updatedKeys = [...currentKeys, newKeyInfo];

    // Update the profile with the new key info
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ api_keys: updatedKeys })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error saving new API key info:', updateError.message);
        return { success: false, error: 'Failed to save API key.' };
    }

    // Return the full key ONCE
    return { success: true, apiKey: fullApiKey };
}

export async function revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'User not authenticated' };

     // Fetch current keys
    const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('api_keys')
        .eq('id', user.id)
        .single();

    if (fetchError || !profileData) {
        console.error('Error fetching profile for API key revocation:', fetchError?.message);
        return { success: false, error: 'Could not load profile data.' };
    }
    
    const currentKeys = Array.isArray(profileData.api_keys) ? profileData.api_keys as ApiKeyInfo[] : [];
    const updatedKeys = currentKeys.filter(key => key.id !== keyId);

    if (updatedKeys.length === currentKeys.length) {
        // Key ID not found, maybe already revoked
        return { success: false, error: 'API key not found.' };
    }

    // Update the profile with the filtered keys
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ api_keys: updatedKeys })
        .eq('id', user.id);

     if (updateError) {
        console.error('Error revoking API key:', updateError.message);
        return { success: false, error: 'Failed to revoke API key.' };
    }

    return { success: true };
} 