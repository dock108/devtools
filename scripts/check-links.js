#!/usr/bin/env node

/**
 * Documentation Link Checker
 *
 * This script checks for broken links in documentation files
 * using the markdown-link-check package.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';
import markdownLinkCheck from 'markdown-link-check';
import { promisify } from 'util';

const globPromise = promisify(glob);
const markdownLinkCheckAsync = promisify(markdownLinkCheck);

// Configuration for markdown-link-check
const config = {
  ignorePatterns: [
    { pattern: '^#' }, // Ignore anchor links (handled by separate check)
    { pattern: '^mailto:' }, // Ignore mailto links
    { pattern: '^(http|https)://localhost' }, // Ignore localhost links
  ],
  replacementPatterns: [
    { pattern: '^/', replacement: 'https://example.com/' }, // Replace relative URLs
  ],
  httpHeaders: [
    {
      urls: ['https://example.com/**'],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    },
  ],
  timeout: '5s',
  retryOn429: true,
  retryCount: 2,
};

// Function to check a single file
async function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const results = await markdownLinkCheckAsync(content, {
      ...config,
      baseUrl: `file://${path.dirname(path.resolve(filePath))}/`,
    });

    const brokenLinks = results.filter((link) => !link.status);

    return brokenLinks.map((link) => ({
      filePath,
      link: link.link,
      message: link.statusCode ? `HTTP ${link.statusCode}` : 'Link not found',
    }));
  } catch (error) {
    console.error(`Error checking links in ${filePath}:`, error);
    return [
      {
        filePath,
        link: 'N/A',
        message: `Error checking links: ${error.message}`,
      },
    ];
  }
}

// Function to check for internal hash links (anchors)
async function validateAnchors(filePath, content) {
  // Extract all headings and their IDs
  const headingMatches = [...content.matchAll(/^(#+)\s+(.+?)$/gm)];
  const headingIds = headingMatches.map((match) => {
    const title = match[2];
    // Simulate the same ID generation logic as in MDX/remark
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  });

  // Extract all internal anchor links
  const anchorMatches = [...content.matchAll(/\[.+?\]\(#(.+?)\)/g)];
  const anchorRefs = anchorMatches.map((match) => match[1]);

  // Check if all anchor references point to valid headings
  const invalidAnchors = anchorRefs.filter((anchor) => !headingIds.includes(anchor));

  return invalidAnchors.map((anchor) => ({
    filePath,
    link: `#${anchor}`,
    message: 'Anchor not found in document',
  }));
}

// Main function
async function main() {
  try {
    // Find all MDX files in the content/docs directory
    const files = await globPromise('content/docs/**/*.mdx');

    console.log(`Checking links in ${files.length} documentation files...`);

    const results = [];

    // Check each file
    for (const file of files) {
      console.log(`Checking ${file}...`);

      const content = fs.readFileSync(file, 'utf8');

      // Check external links
      const brokenExternalLinks = await checkFile(file);
      results.push(...brokenExternalLinks);

      // Check internal anchor links
      const invalidAnchors = await validateAnchors(file, content);
      results.push(...invalidAnchors);
    }

    // Print results
    if (results.length === 0) {
      console.log('✅ All links are valid!');
      process.exit(0);
    } else {
      console.error(`❌ Found ${results.length} broken links:`);

      // Group by file
      const byFile = {};
      results.forEach((result) => {
        if (!byFile[result.filePath]) {
          byFile[result.filePath] = [];
        }
        byFile[result.filePath].push(`${result.link} - ${result.message}`);
      });

      // Print grouped results
      Object.entries(byFile).forEach(([file, links]) => {
        console.error(`\nIn ${file}:`);
        links.forEach((link) => {
          console.error(`  - ${link}`);
        });
      });

      process.exit(1);
    }
  } catch (error) {
    console.error('Error finding documentation files:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
