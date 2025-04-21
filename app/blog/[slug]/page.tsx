import { allBlogs } from 'contentlayer/generated';
import { notFound } from 'next/navigation';
import { MdxRenderer } from '@/components/MdxRenderer';
import { Container } from '@/components/Container';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

// Generate segments for all blog posts at build time
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return allBlogs.map((post) => ({ slug: post.slugAsParams }));
}

// Generate metadata for the page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = allBlogs.find((p) => p.slugAsParams === slug);

  if (!post) {
    return;
  }

  const { title, description, date, image, url } = post;
  const ogImage = image 
    ? `${process.env.NEXT_PUBLIC_SITE_URL}${image}` // Assuming image path starts with / and NEXT_PUBLIC_SITE_URL is set
    : `${process.env.NEXT_PUBLIC_SITE_URL}/og?title=${encodeURIComponent(title)}`; // Fallback OG image generation URL

  return {
    title: `${title} | DOCK108 Blog`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
      publishedTime: date,
      url: url,
      images: [
        {
          url: ogImage,
          // width: 1200, // Specify width/height if known
          // height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImage],
      // creator: "@yourTwitterHandle", // Optional: Add Twitter handle
    },
  };
}

// Render the blog post page
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = allBlogs.find((p) => p.slugAsParams === slug);

  if (!post) {
    return notFound();
  }

  return (
    <Container className="mt-10">
      <article className="prose prose-slate mx-auto max-w-3xl dark:prose-invert lg:prose-lg">
        {/* Post Header */}
        <div className="mb-8 text-center">
          <time dateTime={post.date} className="text-sm text-muted-foreground">
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>
           )}
        </div>
        
        {post.image && (
          <Image 
            src={post.image} 
            alt={post.title} 
            width={1200} 
            height={630} 
            className="mb-8 rounded-lg border object-cover aspect-video"
            priority
          />
        )}

        {/* Post Content */}
        <MdxRenderer code={post.body.code} />
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