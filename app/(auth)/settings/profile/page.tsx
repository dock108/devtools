import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase.schema';
import { getProfile } from '@/lib/supabase/user'; // Import helper

// Import Client Components (assuming they are in the same directory or adjusted path)
// TODO: Adjust paths if these components were moved
import { ProfileForm } from '../ProfileForm'; 
import { PasswordForm } from '../PasswordForm';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { ApiKeysManager } from '../ApiKeysManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Redirect if not logged in (should be handled by layout/middleware, but good practice)
  if (!session) {
    redirect('/login?next=/settings/profile');
  }

  // Fetch profile data
  const profile = await getProfile();

  // Handle case where profile might not exist yet
  if (!profile) {
      console.error('Settings profile page: User session found but profile data missing.');
      // Maybe show an error message within the settings layout instead of redirecting?
      // For now, rendering an error or empty state might be better UX than redirecting.
      return <p className="text-red-500">Could not load profile data.</p>;
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

      <Separator />

      {/* Theme Section */}
      <Card>
         <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred interface theme.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pass the correct theme value, handling potential null/undefined */}
          <ThemeSwitcher currentTheme={profile.theme ?? 'system'} />
        </CardContent>
      </Card>

       <Separator />

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage API keys for accessing DOCK108 services.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pass the correct api_keys value, handling potential null/undefined */}
          <ApiKeysManager initialApiKeys={profile.api_keys ?? []} /> 
        </CardContent>
      </Card>
    </div>
  );
} 