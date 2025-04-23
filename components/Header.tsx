import Link from 'next/link';
import { Container } from './Container';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
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
        </nav>
      </Container>
    </header>
  );
} 
 
 