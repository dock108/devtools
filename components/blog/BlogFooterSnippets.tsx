import Link from 'next/link';
import { getAllPosts, PostMeta } from '@/lib/blog'; // Assuming PostMeta is exported
import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date';
import { ArrowRight, Github, Twitter, Mail } from 'lucide-react';

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trimEnd() + '...';
}

interface SnippetCardProps {
  post: PostMeta;
}

function SnippetCard({ post }: SnippetCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200 h-full"
    >
      <div>
        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {truncateText(post.excerpt, 70)}
        </p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <Badge variant="secondary" className="text-xs">
          {formatDate(post.date, 'short')}
        </Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export async function BlogFooterSnippets() {
  // Fetch latest 3 posts (can be done directly in static components)
  const latestPosts = getAllPosts().slice(0, 3);

  if (latestPosts.length === 0) {
    return null; // Don't render if no posts
  }

  return (
    <div className="py-12 border-t border-muted bg-slate-50/50">
      <Container>
        <h2 className="text-lg font-semibold mb-6 text-center md:text-left">From the Blog</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {latestPosts.map((post) => (
            <SnippetCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </div>
  );
}
