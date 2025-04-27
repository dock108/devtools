import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug, getPrevNextPosts, Post } from '@/lib/blog';
import { MDXRemote } from 'next-mdx-remote/rsc';
import mdxComponents from '@/components/mdx'; // Import custom components
import { Container } from '@/components/Container';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import siteConfig from '@/lib/siteConfig';
import Image from 'next/image';
import { format } from 'date-fns';
import { compileMDX } from 'next-mdx-remote/rsc';
import DemoCTA from '@/components/mdx/DemoCTA';

interface BlogPostPageProps {
  params: { slug: string };
}

// Generate static paths for all blog posts
export async function generateStaticParams() {
  const posts = getAllPosts(); // Gets only metadata including slugs
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for the page
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = getPostBySlug(params.slug);

  if (!post) {
    return { title: 'Post not found' };
  }

  const ogImageUrl = post.image
    ? `${siteConfig.url}${post.image}` // Use absolute URL for OG
    : `${siteConfig.url}/api/og?title=${encodeURIComponent(post.title)}`; // Fallback to dynamic OG

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      url: `${siteConfig.url}/blog/${post.slug}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200, // Adjust if dynamic OG size is different
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [ogImageUrl],
    },
  };
}

// Render the blog post page
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound(); // Trigger 404 if post not found
  }

  const { prev, next } = getPrevNextPosts(params.slug);

  const components = {
    ...mdxComponents,
    DemoCTA,
  };

  return (
    <Container className="py-12 md:py-16 max-w-3xl mx-auto">
      <article>
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime}
            </span>
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* @ts-expect-error Server Component */}
          <MDXRemote source={post.content} components={components} />
        </div>

        {/* Footer Navigation */}
        <footer className="mt-12 pt-8 border-t">
          <div className="flex justify-between gap-8">
            {
              prev ? (
                <Link
                  href={`/blog/${prev.slug}`}
                  className="text-left p-4 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors w-1/2"
                >
                  <div className="text-xs text-muted-foreground mb-1 flex items-center">
                    <ArrowLeft className="h-3 w-3 mr-1" /> Previous
                  </div>
                  <div className="font-medium line-clamp-2">{prev.title}</div>
                </Link>
              ) : (
                <div className="w-1/2"></div>
              ) /* Placeholder for alignment */
            }
            {
              next ? (
                <Link
                  href={`/blog/${next.slug}`}
                  className="text-right p-4 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors w-1/2"
                >
                  <div className="text-xs text-muted-foreground mb-1 flex items-center justify-end">
                    Next <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                  <div className="font-medium line-clamp-2">{next.title}</div>
                </Link>
              ) : (
                <div className="w-1/2"></div>
              ) /* Placeholder for alignment */
            }
          </div>
        </footer>
      </article>
    </Container>
  );
}
