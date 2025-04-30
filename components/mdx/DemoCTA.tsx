import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface DemoCTAProps {
  title?: string;
  description?: string;
  linkText?: string;
  href?: string;
}

/**
 * A component for MDX files to display a call-to-action for the Guardian demo
 */
export default function DemoCTA({
  title = 'Try Guardian in action',
  description = 'See how our Guardian system can detect and prevent fraud in real-time',
  linkText = 'View interactive demo',
  href = '/guardian-demo',
}: DemoCTAProps) {
  return (
    <div className="my-12 rounded-lg border border-indigo-100 bg-indigo-50 p-6">
      <h3 className="mb-2 text-xl font-bold text-indigo-800">{title}</h3>
      <p className="mb-4 text-indigo-700">{description}</p>
      <Link href={href} passHref>
        <Button className="group">
          {linkText}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </Link>
    </div>
  );
}
