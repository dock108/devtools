'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { md5 } from '@/utils/md5';
import { useEffect, useState } from 'react';
import { ShieldAlert, Cog, LogOut, BellIcon } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [loading, setLoading] = useState(true);
  const unreadCount = 0; // TODO: Replace with actual notification count logic
  const markAllRead = () => {}; // TODO: Replace with actual markAllRead logic

  useEffect(() => {
    async function getSession() {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error fetching session:', error);
      } else if (data.session) {
        setSession(data.session);
      }
      
      setLoading(false);
    }

    getSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAlertsClick = () => {
    markAllRead(); // This function is now a placeholder
  };

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
          {/* <Link
            href="/blog"
            data-current={pathname.startsWith('/blog')}
            className="transition hover:underline data-[current=true]:font-semibold data-[current=true]:underline text-slate-300 hover:text-white"
          >
            Blog
          </Link> */}
          {/* <Link
            href="/docs"
            data-current={pathname.startsWith('/docs')}
            className="transition hover:underline data-[current=true]:font-semibold data-[current=true]:underline text-slate-300 hover:text-white"
          >
            Docs
          </Link> */}

          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700"></div>
          ) : session ? (
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
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
                    <Link href="/dashboard" onClick={handleAlertsClick}>
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/settings/profile">
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
