import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">DOCK108</span>
          </Link>
        </div>
        <nav className="flex flex-1 items-center justify-end space-x-6 text-sm font-medium">
          <Link href="/#products" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Products
          </Link>
          <Link href="/docs" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Docs
          </Link>
        </nav>
      </div>
    </header>
  );
} 