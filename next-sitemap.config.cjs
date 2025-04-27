/** @type {import('next-sitemap').IConfig} */
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
};
