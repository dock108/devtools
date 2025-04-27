import { Feed } from 'feed';
import fs from 'fs';
import { getAllPosts } from '../lib/blog';

export async function generateRssFeed() {
  const site_url = process.env['NEXT_PUBLIC_APP_URL'] || 'https://www.dock108.com';

  const feedOptions = {
    title: 'Dock108 Blog | RSS Feed',
    description: 'Stay updated with the latest insights from Dock108',
    id: site_url,
    link: site_url,
    image: `${site_url}/images/og-image.jpg`,
    favicon: `${site_url}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, Dock108`,
    feedLinks: {
      rss: `${site_url}/feed.xml`,
    },
    author: {
      name: 'Dock108 Team',
      email: 'team@dock108.com',
      link: site_url,
    },
  };

  const feed = new Feed(feedOptions);

  // Load posts
  const allPosts = await getAllPosts();

  // Add each post to the feed
  allPosts.forEach((post: any) => {
    feed.addItem({
      title: post.frontmatter.title,
      id: `${site_url}/blog/${post.slug}`,
      link: `${site_url}/blog/${post.slug}`,
      description: post.frontmatter.excerpt,
      date: new Date(post.frontmatter.date),
      image: post.frontmatter.image ? `${site_url}${post.frontmatter.image}` : (undefined as any),
    });
  });

  // Write the RSS feed to a file
  fs.writeFileSync('./public/feed.xml', feed.rss2());
  console.log('✅ RSS feed generated!');
}

// Run the function if this script is executed directly
if (process.argv[1] === import.meta.url) {
  generateRssFeed()
    .then(() => console.log('RSS feed generation complete'))
    .catch((error) => console.error('Error generating RSS feed:', error));
}
