import { notFound } from 'next/navigation';
import { Container } from '@/components/Container';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPostSlugs, getPostData } from '@/lib/blog';
import dynamic from 'next/dynamic'; // Needed for dynamic import

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
  const ogImage = `/blog/${slug}/opengraph-image`;

  return {
    title: `${title} | DOCK108 Blog`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
      publishedTime: date,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}${url}`,
      images: [ogImage],
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
        {/* Post content follows directly without header or hero image */}
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