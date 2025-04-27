import { withSentryConfig } from '@sentry/nextjs';
import { fileURLToPath } from 'url';
import path from 'path';
// Remove unused MDX/prism imports
// import rehypePrism from 'rehype-prism-plus';

// In ESM, __dirname is not defined by default – define it manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  // Workaround for lightningcss issues on Vercel
  experimental: {
    // Disable new CSS transforms on Vercel
    optimizeCss: false,
    // Disable Turbopack in production
    turbo: undefined,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Remove mdx/md from page extensions
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Explicitly configure webpack aliases
  webpack: (config) => {
    // Alias '@/' to project root
    config.resolve.alias['@'] = __dirname;
    return config;
  },
};

// Wrap the config with Sentry
// Make sure to move this part below your original config definition
export default withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: process.env.SENTRY_ORG, // Required: Your Sentry organization slug
    project: process.env.SENTRY_PROJECT, // Required: Your Sentry project slug
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (?)
    // See the following for more information:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/vercel-cron-monitors/
    automaticVercelMonitors: true,
  },
);
