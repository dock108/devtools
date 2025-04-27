import fs from 'fs';
import path from 'path';
import RSS from 'rss';
import { getAllPosts } from '../lib/blog.ts'; // Add explicit .ts extension
import { pathToFileURL } from 'url'; // Import necessary function

// Export the core function for testing
export async function generateRssFeed() {
  console.log('Generating RSS feed...');

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const allPosts = getAllPosts(); // Assuming this returns metadata including slug, title, excerpt, date, tags

  const feedOptions = {
    title: 'Stripe Guardian Blog',
    description: 'Product updates & payout-fraud insights',
    site_url: siteUrl,
    feed_url: `${siteUrl}/feed.xml`,
    language: 'en',
    pubDate: new Date(), // Use current date for feed publication
    copyright: `© ${new Date().getFullYear()} DOCK108`,
  };

  const feed = new RSS(feedOptions);

  allPosts.forEach((post) => {
    feed.item({
      title: post.title,
      description: post.excerpt, // Use excerpt as description
      url: `${siteUrl}/blog/${post.slug}`, // Link to the post
      guid: post.slug, // Use slug as unique identifier
      categories: post.tags || [], // Use tags as categories
      author: 'Dock108 Dev Team', // Static author
      date: new Date(post.date), // Use post date
    });
  });

  const xmlContent = feed.xml({ indent: true });

  // Write the XML to public/feed.xml
  const outputPath = path.join(process.cwd(), 'public', 'feed.xml');
  fs.writeFileSync(outputPath, xmlContent);

  console.log(`RSS feed generated successfully at ${outputPath}`);
  return xmlContent; // Return content for testing
}

// Use ES Module standard check for direct execution
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateRssFeed().catch((error) => {
    console.error('Error generating RSS feed:', error);
    process.exit(1);
  });
}
