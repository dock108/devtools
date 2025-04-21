// import { withContentlayer } from 'next-contentlayer'; // Removed
import createNextMdx from '@next/mdx';
import type { NextConfig } from 'next';

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
  // Add other config options here
};

// Wrap the config only with MDX now
export default withMDX(nextConfig);