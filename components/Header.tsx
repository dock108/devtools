'use client';
import Link from 'next/link';
import { Container } from './Container';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useSession } from '@/hooks/useSession';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import { md5 } from '@/utils/md5';
import { useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useSession();

  useEffect(() => {
    console.log('Header session state:', session);
    console.log('Header loading state:', loading);
  }, [session, loading]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
          
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-slate-700"></div>
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarImage src={`https://www.gravatar.com/avatar/${md5(session.user.email || '')}?d=mp`} />
                  <AvatarFallback>{(session.user.email || 'U')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/settings/accounts">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleSignOut}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
 
 