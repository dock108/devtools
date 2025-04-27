const { getAllPosts } = require('./lib/blog'); // Use require for CJS config file

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://guardian.dock108.ai', // Default to production URL
  generateRobotsTxt: true, // Generate robots.txt
  robotsTxtOptions: {
    // Optional: Add policies if needed, e.g., disallow certain paths
    policies: [{ userAgent: '*', allow: '/' }],
  },
  // Optional: Exclude specific routes if necessary
  // exclude: ['/admin/*', '/api/*'],
  // Configure paths to be included
  transform: async (config, path) => {
    // Default priority and changefreq
    return {
      loc: path,
      changefreq: config.changefreq, // 'daily', 'weekly', etc.
      priority: config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    };
  },
  additionalPaths: async (config) => {
    // Blog Posts
    const posts = getAllPosts(); // Use the existing function
    const blogPaths = posts.map((post) => ({
      loc: `/blog/${post.slug}`,
      lastmod: post.updated || post.date, // Use updated date if available
      changefreq: 'weekly', // Or 'monthly' depending on update frequency
      priority: 0.7,
    }));

    // Docs Pages - Assuming they live in app/docs/
    // Adjust glob pattern if docs are structured differently
    const docsRoot = await config.transform(config, '/docs');
    const docsPages = await config.transform(config, '/docs/**/*');

    // Add custom transformation for docs if needed (e.g., different priority)
    const transformedDocsPages = docsPages
      .filter((page) => page.loc !== '/docs') // Exclude the root if it's just an index
      .map((page) => ({
        ...page,
        changefreq: 'monthly',
        priority: 0.6,
      }));

    return [
      ...blogPaths,
      docsRoot, // Include the main /docs page if it exists
      ...transformedDocsPages,
    ];
  },
  // Point to the app directory for App Router
  // Note: next-sitemap might infer this, but explicitly setting can help
  // Ensure your project structure aligns if using a different pagesDir source
  // pagesDirectory: path.resolve(__dirname, 'app'), // Might not be needed with recent versions
};
