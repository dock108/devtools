// import { withContentlayer } from 'next-contentlayer'; // Removed
import createNextMdx from '@next/mdx';
import type { NextConfig } from 'next';
import path from 'path'; // Import path module

// Configure MDX
const withMDX = createNextMdx({
  // Add MDX options here, if needed
  extension: /\.mdx?$/,
  options: {
    // remarkPlugins: [],
    // rehypePlugins: [],
    // If you use `MDXProvider`, uncomment the following line.
    // providerImportSource: "@mdx-js/react",
  },
});

// Base Next.js config
const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'], // Add md/mdx extensions
  reactStrictMode: true,
  transpilePackages: ['next-mdx-remote'],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add webpack config
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Ensure only one copy of React is used
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    return config;
  },
  // Add other config options here
};

// Wrap the config only with MDX now
export default withMDX(nextConfig);
