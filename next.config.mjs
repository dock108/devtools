import createMDX from '@next/mdx';
import { fileURLToPath } from 'url';
import path from 'path';

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
  // Explicitly configure webpack aliases
  webpack: (config) => {
    // Alias '@/' to project root
    config.resolve.alias['@'] = __dirname;
    return config;
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
