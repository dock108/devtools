/** @type {import('next-sitemap').IConfig} */
const siteUrl = 'https://www.dock108.ai';

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  sitemapSize: 5000,
  exclude: ['/opengraph-image', '/blog/*/opengraph-image'],
}; 