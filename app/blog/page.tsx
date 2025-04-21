import { allBlogs } from 'contentlayer/generated';
import Link from 'next/link';
import { Container } from '@/components/Container';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | DOCK108',
  description: 'Updates, articles, and insights from the DOCK108 team.',
};

export default function BlogIndex() {
  // Sort posts by date, newest first
  const posts = allBlogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Container>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-8">
          DOCK108 Blog
        </h1>
        <ul className="space-y-8">
          {posts.map((post) => (
            <li key={post._id}>
              <article>
                <Link href={post.url} className="block">
                  <h2 className="text-2xl font-semibold tracking-tight hover:text-primary hover:underline">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-2 text-sm text-gray-500">
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {post.tags && post.tags.length > 0 && (
                     <span className="ml-2">· {post.tags.join(', ')}</span>
                  )}
                </p>
                <p className="mt-3 text-base text-gray-600">
                  {post.description}
                </p>
                <Link 
                  href={post.url} 
                  className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                >
                   Read more <span aria-hidden="true">→</span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
} 