import { Container } from '@/components/Container';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container className="py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-sm text-slate-500 mb-2">
            <Link href="/" className="hover:text-slate-700">Home</Link>
            {' / '}
            <Link href="/settings" className="hover:text-slate-700">Settings</Link>
            {' / '}
            <span className="text-slate-900">Connected Accounts</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>

        <Tabs defaultValue="accounts" className="mb-8">
          <TabsList>
            <TabsTrigger value="accounts" asChild>
              <Link href="/settings/accounts">Connected Accounts</Link>
            </TabsTrigger>
            <TabsTrigger value="notifications" asChild>
              <Link href="/settings/notifications">Notifications</Link>
            </TabsTrigger>
            <TabsTrigger value="profile" asChild>
              <Link href="/settings/profile">Profile</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {children}
      </div>
    </Container>
  );
} 