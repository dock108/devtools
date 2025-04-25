import { notFound } from 'next/navigation';
import { Container } from '@/components/Container';
import type { Metadata } from 'next';
import Link from 'next/link';
// Remove MDX-specific imports
// import { getAllPostSlugs, getPostData } from '@/lib/blog'; // Original MDX helper
// import { MDXRemote } from 'next-mdx-remote/rsc';
// import { useMDXComponents } from '@/mdx-components';
// import * as CustomComponents from '@/mdx-components';
import { blogLD } from '@/lib/jsonld';

// Import necessary libraries for Markdown processing
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAllPostSlugs, getPostData } from '@/lib/markdown'; // Switch to new Markdown helper
import { markdownComponents } from '@/components/MarkdownComponents'; // Import custom components

// Disable static rendering – fallback to SSR to avoid build‑time MDX errors
// export const dynamic = 'force-dynamic'; // REMOVED - Attempting static generation

// Helper to safely import MDX content, replacing with fallback if missing/broken
// const getMdxComponent = (slug: string) =>
//   dynamicImport(async () => {
//     try {
//       const mod = await import(`@/content/blog/${slug}.mdx`);
//       return mod.default;
//     } catch (err) {
//       console.error('Failed to load MDX for', slug, err);
//       return () => <p className="text-red-600">Post content unavailable.</p>;
//     }
//   });

// Generate segments for all blog posts at build time
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllPostSlugs().map(({ params }) => ({ slug: params.slug }));
}

// Generate metadata for the page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = await getPostData(slug); // Use new helper

  if (!post) {
    return;
  }

  const { title, description, date, url } = post;
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dock108.ai';
  const fullUrl = `${site}${url}`;
  const ogImage = `${fullUrl}/opengraph-image`;

  return {
    title: `${title} | DOCK108 Blog`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
      publishedTime: date,
      url: fullUrl,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImage],
    },
    other: {
      'script:type=application/ld+json': JSON.stringify(
        blogLD({
          title,
          description,
          url: fullUrl,
          image: ogImage,
          date,
        })
      ),
    },
  };
}

// Render the blog post page
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostData(slug); // Fetch post metadata and content string

  if (!post || !post.content) { // Check if content exists
    return notFound();
  }

  return (
    <Container className="mt-10">
      <article className="mx-auto max-w-3xl">
         <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
         <p className="text-sm text-slate-500">Published on {new Date(post.date).toLocaleDateString()}</p>
         {/* Render markdown with custom components */}
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]}
           components={markdownComponents} // Pass the custom components
         >
           {post.content}
         </ReactMarkdown>
      </article>

      {/* Back link */}
      <div className="mt-12 text-center">
        <Link href="/blog" className="text-sm font-medium text-primary hover:underline">
          ← Back to Blog
        </Link>
      </div>
    </Container>
  );
} 