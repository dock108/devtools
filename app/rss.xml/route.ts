import { getSortedPostsData } from '@/lib/blog';
import { Feed } from 'feed';

export async function GET(): Promise<Response> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dock108.ai';

  const feed = new Feed({
    id: site,
    title: 'DOCK108 Blog',
    description: 'Developer‑first fixes for real pain.',
    link: site,
    language: 'en',
    favicon: `${site}/favicon.ico`,
    updated: new Date(),
    copyright: `© ${new Date().getFullYear()} DOCK108`,
  });

  getSortedPostsData().forEach((post) => {
    feed.addItem({
      id: `${site}/blog/${post.slug}`,
      title: post.title,
      link: `${site}/blog/${post.slug}`,
      description: post.description,
      date: new Date(post.date),
    });
  });

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=UTF-8',
    },
  });
} 