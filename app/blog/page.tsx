import { getAllPosts, PostMeta } from '@/lib/blog';
import { Container } from '@/components/Container';
import BlogCard from '@/components/blog/BlogCard';
import { Pagination } from '@/components/ui/Pagination';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Insights, updates, and stories from the DOCK108 team.',
  // Add OG data specific to the blog index
  openGraph: {
    title: 'DOCK108 Blog',
    description: 'Insights, updates, and stories from the DOCK108 team.',
    url: '/blog',
    images: [
      {
        url: '/images/og-default.png', // Use default OG for index
        width: 1200,
        height: 630,
        alt: 'DOCK108 Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DOCK108 Blog',
    description: 'Insights, updates, and stories from the DOCK108 team.',
    images: ['/images/og-default.png'],
  },
};

const POSTS_PER_PAGE = 12;

interface BlogIndexPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const allPosts = getAllPosts();
  const currentPage = Number(searchParams?.['page']) || 1;
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);

  const paginatedPosts = allPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE,
  );

  return (
    <Container className="py-12 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Blog</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Insights, updates, and stories from the DOCK108 team.
      </p>

      {paginatedPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {paginatedPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <p>No blog posts found.</p> // Handle case with no posts
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl="/blog" />
    </Container>
  );
}
