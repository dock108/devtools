import createMDX from '@next/mdx';
import { fileURLToPath } from 'url';
import path from 'path'; // Import path module

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
    optimizeCss: false
  },
  // Explicitly configure webpack aliases
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add alias based on tsconfig paths
    config.resolve.alias['@'] = path.resolve(__dirname); // Resolve '@' to the project root

    // Important: return the modified config
    return config;
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig); 