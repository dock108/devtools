/** @type {import('next-sitemap').IConfig} */
/*
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.dock108.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
  exclude: [
    '/api/*',
    '/admin/*',
    '/stripe-guardian/accounts/*/settings',
    '/stripe-guardian/alerts/*',
    '/guardian-demo',
  ],
  // Optional: Exclude specific routes if necessary
  // exclude: ['/admin/*', '/api/*'],
  // Configure paths to be included
  // Optional: Add outDir if needed, defaults usually work with Next.js `app` dir
  // outDir: './out',
  // Let next-sitemap discover pages automatically from the build manifest
  // Remove additionalPaths and transform unless specific overrides are needed

  // Add explicit configuration for blog and docs pages
  additionalPaths: async (config) => {
    // Get a list of blog posts from the content directory
    const fs = require('fs');
    const path = require('path');

    const result = [];
    const postsDir = path.join(process.cwd(), 'content/blog');

    try {
      const blogFiles = fs.readdirSync(postsDir).filter((file) => file.endsWith('.mdx'));

      blogFiles.forEach((file) => {
        const slug = file.replace(/\.mdx$/, '');
        result.push({
          loc: `/blog/${slug}`,
          lastmod: new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        });
      });

      console.log(`Added ${result.length} blog pages to sitemap`);
      return result;
    } catch (error) {
      console.error('Error reading blog directory:', error);
      return [];
    }
  },
};
*/
