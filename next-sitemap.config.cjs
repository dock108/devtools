/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://dock108.com',
  generateRobotsTxt: true,
  exclude: ['/admin/*', '/api/*', '/settings/*', '/callback', '/login', '/sign-up'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/settings/'],
      },
    ],
  },
  // Optional: Exclude specific routes if necessary
  // exclude: ['/admin/*', '/api/*'],
  // Configure paths to be included
  // Optional: Add outDir if needed, defaults usually work with Next.js `app` dir
  // outDir: './out',
  // Let next-sitemap discover pages automatically from the build manifest
  // Remove additionalPaths and transform unless specific overrides are needed
};
