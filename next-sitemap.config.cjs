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
  // Optional: Add outDir if needed, defaults usually work with Next.js `app` dir
  // outDir: './out',
  // Let next-sitemap discover pages automatically from the build manifest
  // Remove additionalPaths and transform unless specific overrides are needed
};
