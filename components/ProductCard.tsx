import Link from 'next/link';
import { cn } from '@/lib/utils';
import React from 'react'; // Import React for style prop typing

interface ProductCardProps {
  title: string;
  blurb: string;
  href: string;
  accent: 'guardian' | 'notary' | 'crondeck';
}

// Map accent keys to CSS variables
const accentVars: Record<ProductCardProps['accent'], string> = {
  guardian: 'var(--accent-guardian)',
  notary: 'var(--accent-notary)',
  crondeck: 'var(--accent-crondeck)',
};

export function ProductCard({ title, blurb, href, accent }: ProductCardProps) {
  const accentColor = accentVars[accent];

  // Define inline style for the shadow color
  const cardStyle: React.CSSProperties = {
    '--tw-shadow-color': accentColor,
    borderColor: accentColor, // Set border color for the top border
  } as React.CSSProperties;

  return (
    <div 
      className={cn(
        'group relative flex flex-col rounded-2xl border border-t-2 bg-white p-8 transition-all duration-300 ease-in-out hover:-translate-y-1', // Updated padding, radius, border-t
        'hover:shadow-[0_6px_25px_-4px_var(--tw-shadow-color)]' // Use custom property shadow
      )}
      style={cardStyle} // Apply inline style
    >
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground flex-grow">{blurb}</p>
      <Link href={href} className="mt-auto text-sm font-medium text-primary underline-offset-4 hover:underline">
        Learn More <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
} 