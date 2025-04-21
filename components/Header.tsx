import Link from 'next/link';
import { Container } from './Container';
import Image from 'next/image';

export function Header() {
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
          <Link href="/#products" className="text-slate-300 transition-colors hover:text-white">
            Products
          </Link>
          <Link href="/blog" className="text-slate-300 transition-colors hover:text-white">
            Blog
          </Link>
          <Link href="/docs" className="text-slate-300 transition-colors hover:text-white">
            Docs
          </Link>
        </nav>
      </Container>
    </header>
  );
} 