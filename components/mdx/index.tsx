import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils'; // Assuming shadcn/ui utils

// Custom components mapping
const mdxComponents = {
  // Apply custom styles to headings
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn('mt-2 scroll-m-20 text-3xl font-bold tracking-tight', className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        'mt-10 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn('mt-8 scroll-m-20 text-xl font-semibold tracking-tight', className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn('leading-7 [&:not(:first-child)]:mt-6', className)} {...props} />
  ),
  // Style blockquotes as Alerts
  blockquote: ({ className, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <Alert
      className={cn(
        'mt-6 border-l-4 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
      {...props}
    />
    // Example with explicit title/desc - requires markdown structure change
    // <Alert className={cn('mt-6', className)}>
    //     <AlertTitle>Note</AlertTitle>
    //     <AlertDescription>
    //         {props.children}
    //     </AlertDescription>
    // </Alert>
  ),
  // Basic list styling
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn('my-6 ml-6 list-disc [&>li]:mt-2', className)} {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className={cn('my-6 ml-6 list-decimal [&>li]:mt-2', className)} {...props} />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <li className={cn('', className)} {...props} />
  ),
  // Inline code
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
        className,
      )}
      {...props}
    />
  ),
  // Next.js Image for markdown images
  // Note: Requires image dimensions or `fill` prop.
  // You might need a rehype plugin to add dimensions automatically.
  img: ({
    className,
    alt,
    src,
    width,
    height,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // Assuming src is a local path within /public
    // Adjust logic if using remote images or different paths
    if (!src) return null;
    return (
      <Image
        className={cn('rounded-md border my-6', className)}
        src={src}
        alt={alt ?? ''}
        width={width ? Number(width) : 700} // Default width or parse from props
        height={height ? Number(height) : 400} // Default height or parse from props
        {...(props as any)}
      />
    );
  },
  // Standard Link component
  a: ({ className, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href?.startsWith('/')) {
      return (
        <Link
          href={href}
          className={cn('font-medium underline underline-offset-4', className)}
          {...props}
        />
      );
    }
    if (href?.startsWith('#')) {
      return (
        <a
          className={cn('font-medium underline underline-offset-4', className)}
          href={href}
          {...props}
        />
      );
    }
    // External link
    return (
      <a
        className={cn('font-medium underline underline-offset-4', className)}
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        {...props}
      />
    );
  },
  // Add other custom components as needed (e.g., for tables, hr, etc.)
  // Pre component styling is handled by rehype-shiki plugin
};

export default mdxComponents;
