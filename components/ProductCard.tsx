import Link from 'next/link';
import { cn } from '@/lib/utils'; // Assuming shadcn setup this utility

interface ProductCardProps {
  title: string;
  blurb: string;
  href: string;
  accent: 'guardian' | 'notary' | 'crondeck';
}

const accentClasses = {
  guardian: 'border-accent-guardian shadow-accent-guardian/30',
  notary: 'border-accent-notary shadow-accent-notary/30',
  crondeck: 'border-accent-crondeck shadow-accent-crondeck/30',
};

export function ProductCard({ title, blurb, href, accent }: ProductCardProps) {
  return (
    <div className={cn(
      'group relative flex flex-col rounded-[--radius-card] border bg-white p-6 transition-transform duration-300 ease-in-out hover:-translate-y-1',
      accentClasses[accent],
      'hover:shadow-lg' // Apply accent shadow on hover
    )}>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground flex-grow">{blurb}</p>
      <Link href={href} className="mt-auto text-sm font-medium text-primary underline-offset-4 hover:underline">
        Learn More <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
} 