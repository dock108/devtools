import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string; // e.g., '/blog'
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  baseUrl,
  className,
}) => {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  if (totalPages <= 1) {
    return null; // Don't render pagination if only one page
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-4 mt-12', className)}
    >
      <Button asChild variant="outline" disabled={!hasPrev}>
        <Link
          href={`${baseUrl}?page=${currentPage - 1}`}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          className={!hasPrev ? 'pointer-events-none opacity-50' : ''}
        >
          Previous
        </Link>
      </Button>

      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      <Button asChild variant="outline" disabled={!hasNext}>
        <Link
          href={`${baseUrl}?page=${currentPage + 1}`}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          className={!hasNext ? 'pointer-events-none opacity-50' : ''}
        >
          Next
        </Link>
      </Button>
    </nav>
  );
};
