import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRightIcon } from '@radix-ui/react-icons';

interface DemoCTAProps {
  href: string;
  label: string;
  blurb: string;
}

export function DemoCTA({ href, label, blurb }: DemoCTAProps) {
  return (
    <div className="mt-8 p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
      <p className="text-lg font-semibold mb-2">{label}</p>
      <p className="text-sm text-muted-foreground mb-4">{blurb}</p>
      <Button asChild variant="default" className="w-full sm:w-auto">
        <Link href={href}>
          {label}
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
