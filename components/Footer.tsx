import Link from 'next/link';
import { Container } from './Container';

export function Footer() {
  return (
    <footer className="py-12">
      <Container className="flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          © 2025 DOCK108
        </p>
        <div className="ml-auto flex gap-4">
          <Link href="https://twitter.com/dock108" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4 text-sm text-muted-foreground hover:text-foreground">
            Twitter
          </Link>
          <Link href="https://github.com/dock108" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4 text-sm text-muted-foreground hover:text-foreground">
            GitHub
          </Link>
        </div>
      </Container>
    </footer>
  );
} 