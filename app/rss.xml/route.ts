import { getAllPosts } from '@/lib/blog';
import { Feed } from 'feed';

export async function GET(): Promise<Response> {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dock108.com';

  const feed = new Feed({
    id: site,
    title: 'Dock108 Blog',
    description: 'Fraud protection for Stripe Connect platforms',
    link: site,
    language: 'en',
    favicon: `${site}/favicon.ico`,
    updated: new Date(),
    copyright: `© ${new Date().getFullYear()} Dock108`,
  });

  const posts = await getAllPosts();

  posts.forEach((post) => {
    // Skip posts with missing required data
    if (!post.frontmatter?.title || !post.frontmatter?.date) {
      console.warn(`Skipping RSS entry for post ${post.slug} due to missing required frontmatter`);
      return;
    }

    feed.addItem({
      id: `${site}/blog/${post.slug}`,
      title: post.frontmatter.title,
      link: `${site}/blog/${post.slug}`,
      description: post.frontmatter.excerpt || '',
      date: new Date(post.frontmatter.date),
      image: post.frontmatter.image ? `${site}${post.frontmatter.image}` : undefined,
    });
  });

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=UTF-8',
    },
  });
}
