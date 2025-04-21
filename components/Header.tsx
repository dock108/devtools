import Link from 'next/link';
import { Container } from './Container';
import Image from 'next/image';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
          <Link href="/#products" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Products
          </Link>
          <Link href="/docs" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Docs
          </Link>
        </nav>
      </Container>
    </header>
  );
} 