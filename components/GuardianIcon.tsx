import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuardianIconProps {
  className?: string;
}

export const GuardianIcon = ({ className }: GuardianIconProps) => (
  <ShieldCheck
    className={cn(
      'h-8 w-8 stroke-[2.5] text-[var(--accent-guardian)]',
      className,
    )}
    aria-hidden="true"
  />
); 