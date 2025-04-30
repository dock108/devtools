import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase.d';
import { getProfile } from '@/lib/supabase/user'; // Import helper

// Import Client Components (assuming they are in the same directory or adjusted path)
// TODO: Adjust paths if these components were moved
import { ProfileForm } from '../ProfileForm';
import { PasswordForm } from '../PasswordForm';
// import { ThemeSwitcher } from '../ThemeSwitcher'; // Removed import
import { ApiKeysManager } from '../ApiKeysManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function SettingsProfilePage() {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirect if not logged in (should be handled by layout/middleware, but good practice)
  if (!session) {
    redirect('/login?next=/settings/profile');
  }

  // Fetch profile data
  const profile = await getProfile();

  // If profile fetch failed or row doesn't exist, log it, but proceed.
  // The child components should handle a null/empty profile.
  if (!profile) {
    console.error(
      'Settings profile page: User session found but profile data is missing or failed to load.',
    );
    // We won't redirect or return early. Let the page render with profile=null.
  }

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Separator />

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {/* Removed Theme Section and Separator */}

      {/* Conditionally render API Keys Section based on feature flag */}
      {process.env.NEXT_PUBLIC_SHOW_KEYS === 'true' && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for accessing DOCK108 services.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysManager initialApiKeys={profile?.api_keys ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
