'use client';
import Link from 'next/link';
import { Container } from './Container';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useSession } from '@/hooks/useSession';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import { md5 } from '@/utils/md5';
import { useEffect, useState } from 'react';
import { ShieldAlert, Plug, Cog, LogOut, BellIcon } from 'lucide-react';
import { useAlertNotifications } from '@/app/context/useAlertNotifications';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useSession();
  const [connectedAccounts, setConnectedAccounts] = useState<any[] | null>(null);
  const { unreadCount, markAllRead } = useAlertNotifications();

  useEffect(() => {
    if (session?.user?.id) {
      const fetchAccounts = async () => {
        const { data, error } = await supabase
          .from('connected_accounts')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (error) {
          console.error('Error fetching connected accounts:', error);
          setConnectedAccounts([]);
        } else {
          setConnectedAccounts(data || []);
        }
      };
      fetchAccounts();
    } else {
      setConnectedAccounts(null);
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleAlertsClick = () => {
    markAllRead();
  };

  const showConnectLink = session && connectedAccounts !== null && connectedAccounts.length === 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-700/60 bg-slate-900">
      <Container className="flex h-14 items-center">
        <div className="mr-auto flex">
          <Link href="/" className="mr-6 flex items-center">
            <Image
              src="/logo.png"
              alt="DOCK108 logo"
              width={140}
              height={32}
              priority
              className="h-8 w-auto"
            />
            <span className="sr-only">DOCK108</span>
          </Link>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link
            href="/#products"
            data-current={pathname === '/#products'}
            className="transition hover:underline data-[current=true]:font-semibold data-[current=true]:underline text-slate-300 hover:text-white"
          >
            Products
          </Link>
          <Link
            href="/blog"
            data-current={pathname.startsWith('/blog')}
            className="transition hover:underline data-[current=true]:font-semibold data-[current=true]:underline text-slate-300 hover:text-white"
          >
            Blog
          </Link>
          <Link
            href="/docs"
            data-current={pathname.startsWith('/docs')}
            className="transition hover:underline data-[current=true]:font-semibold data-[current=true]:underline text-slate-300 hover:text-white"
          >
            Docs
          </Link>

          {loading || (session && connectedAccounts === null) ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700"></div>
          ) : session ? (
            <div className="flex items-center space-x-4">
              <Link
                href="/guardian/alerts"
                onClick={handleAlertsClick}
                className="relative text-slate-300 hover:text-white"
                aria-label={`View alerts (${unreadCount} unread)`}
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage
                      src={`https://www.gravatar.com/avatar/${md5(session.user.email || '')}?d=mp`}
                    />
                    <AvatarFallback>{(session.user.email || 'U')[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/stripe-guardian/alerts" onClick={handleAlertsClick}>
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>

                  {showConnectLink && (
                    <DropdownMenuItem asChild>
                      <Link href="/stripe-guardian/onboard">
                        <Plug className="mr-2 h-4 w-4" />
                        <span>Connect account</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Cog className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Log In</Link>
            </Button>
          )}
        </nav>
      </Container>
    </header>
  );
}
