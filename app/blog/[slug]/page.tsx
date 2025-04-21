import { notFound } from 'next/navigation';
import { Container } from '@/components/Container';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getAllPostSlugs, getPostData } from '@/lib/blog';
import { mdxComponents } from '@/mdx-components'; // Updated path
import dynamic from 'next/dynamic'; // Needed for dynamic import

// Generate segments for all blog posts at build time
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllPostSlugs(); // Use new helper
}

// Generate metadata for the page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = await getPostData(slug); // Use new helper

  if (!post) {
    return;
  }

  const { title, description, date, image, url } = post;
  const ogImage = image
    ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}${image}` // Ensure SITE_URL is set
    : `${process.env.NEXT_PUBLIC_SITE_URL || ''}/og?title=${encodeURIComponent(title)}`; // Fallback OG image generation URL

  return {
    title: `${title} | DOCK108 Blog`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
      publishedTime: date, // Ensure date is in ISO format for this
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}${url}`,
      images: [
        {
          url: ogImage,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImage],
    },
  };
}

// Dynamically import the MDX component based on slug
const getMdxComponent = (slug: string) => dynamic(() => import(`@/content/blog/${slug}.mdx`));


// Render the blog post page
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostData(slug); // Fetch post metadata and content path

  if (!post) {
    return notFound();
  }

  // Dynamically load the MDX component
  const MDXContent = getMdxComponent(slug);

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

        {/* Post Content - Render the dynamically imported component */}
        {/* Ensure mdx-components.tsx is correctly configured and picked up by @next/mdx */}
        {/* Or pass components explicitly: <MDXContent components={mdxComponents} /> */}
        <MDXContent />
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