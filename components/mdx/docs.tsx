// 'use client'; // Remove this directive

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import mdxComponents from '@/components/mdx';
import { AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export interface AlertProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
}

const Alert = ({ type = 'info', title, children }: AlertProps) => {
  const icons = {
    info: <Info className="h-5 w-5 text-blue-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
  };

  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200',
    warning:
      'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200',
    error:
      'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-900 dark:text-red-200',
    success:
      'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-900 dark:text-green-200',
  };

  return (
    <div className={cn('my-6 rounded-lg border p-4', styles[type])}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">{icons[type]}</div>
        <div>
          {title && <div className="mb-1 font-medium">{title}</div>}
          <div className={cn('text-sm', !title && 'pt-0.5')}>{children}</div>
        </div>
      </div>
    </div>
  );
};

// Customized docs components that extend base MDX components
const docsComponents = {
  ...mdxComponents,
  // Override some components with docs-specific styling
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn('mt-2 scroll-m-20 text-4xl font-bold tracking-tight', className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        'mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn('mt-8 scroll-m-20 text-2xl font-semibold tracking-tight', className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className={cn('mt-8 scroll-m-20 text-xl font-semibold tracking-tight', className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn('leading-7 [&:not(:first-child)]:mt-6', className)} {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn('my-6 ml-6 list-disc [&>li]:mt-2', className)} {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className={cn('my-6 ml-6 list-decimal [&>li]:mt-2', className)} {...props} />
  ),
  // Add our own special components
  Alert,
};

export default docsComponents;
