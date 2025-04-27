#!/usr/bin/env tsx
/**
 * Script to compare bundle sizes before and after changes
 * This script reads the NextJS build manifest and reports changes
 *
 * Usage:
 * 1. Create a baseline: npx tsx scripts/compare-bundle-sizes.ts --save
 * 2. After changes: npx tsx scripts/compare-bundle-sizes.ts
 */

import fs from 'fs';
import path from 'path';

// Define paths
const BUILD_DIR = path.join(process.cwd(), '.next');
const BASELINE_FILE = path.join(process.cwd(), '.bundle-baseline.json');

// Parse command line arguments
const saveBaseline = process.argv.includes('--save');

interface BundleInfo {
  totalSize: number;
  pageCount: number;
  pages: Record<string, number>;
}

/**
 * Read build manifest and extract bundle sizes
 */
function getBundleInfo(): BundleInfo | null {
  try {
    // Check if build directory exists
    if (!fs.existsSync(BUILD_DIR)) {
      console.error('Build directory not found. Run npm run build first.');
      return null;
    }

    const buildManifestPath = path.join(BUILD_DIR, 'build-manifest.json');
    if (!fs.existsSync(buildManifestPath)) {
      console.error('Build manifest not found. Run npm run build first.');
      return null;
    }

    // Read build manifest
    const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));

    // Get page info
    const pages: Record<string, number> = {};
    let totalSize = 0;

    // Process each page
    Object.entries(buildManifest.pages).forEach(([page, assets]: [string, any]) => {
      if (Array.isArray(assets)) {
        const pageSize = assets.reduce((size, asset) => {
          const assetPath = path.join(BUILD_DIR, asset);
          return size + (fs.existsSync(assetPath) ? fs.statSync(assetPath).size : 0);
        }, 0);

        pages[page] = pageSize;
        totalSize += pageSize;
      }
    });

    return {
      totalSize,
      pageCount: Object.keys(pages).length,
      pages,
    };
  } catch (error) {
    console.error('Error reading build information:', error);
    return null;
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate and format percentage change
 */
function formatChange(current: number, previous: number): string {
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Save current bundle info as baseline
 */
function saveBaselineInfo(info: BundleInfo): void {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(info, null, 2));
  console.log(`✅ Saved bundle baseline (${formatBytes(info.totalSize)}, ${info.pageCount} pages)`);
}

/**
 * Compare current bundle info with baseline
 */
function compareWithBaseline(current: BundleInfo): void {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('❌ Baseline file not found. Run with --save first.');
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));

  console.log('\n📊 Bundle Size Comparison:\n');

  console.log('Total Bundle Size:');
  console.log(`  Before: ${formatBytes(baseline.totalSize)}`);
  console.log(`  After:  ${formatBytes(current.totalSize)}`);
  console.log(
    `  Change: ${formatBytes(current.totalSize - baseline.totalSize)} (${formatChange(current.totalSize, baseline.totalSize)})`,
  );

  console.log('\nPage Count:');
  console.log(`  Before: ${baseline.pageCount}`);
  console.log(`  After:  ${current.pageCount}`);

  // Find pages with significant changes
  console.log('\nPages with significant size changes:');

  let hasSignificantChanges = false;

  // Check pages in current build
  Object.entries(current.pages).forEach(([page, size]) => {
    if (baseline.pages[page]) {
      const change = size - baseline.pages[page];
      const percentChange = (change / baseline.pages[page]) * 100;

      if (Math.abs(percentChange) > 5) {
        // Only show changes > 5%
        hasSignificantChanges = true;
        console.log(`  ${page}:`);
        console.log(`    Before: ${formatBytes(baseline.pages[page])}`);
        console.log(`    After:  ${formatBytes(size)}`);
        console.log(
          `    Change: ${formatBytes(change)} (${formatChange(size, baseline.pages[page])})`,
        );
      }
    } else {
      // New page
      hasSignificantChanges = true;
      console.log(`  ${page} (new): ${formatBytes(size)}`);
    }
  });

  // Check for removed pages
  Object.entries(baseline.pages).forEach(([page, size]) => {
    if (!current.pages[page]) {
      hasSignificantChanges = true;
      console.log(`  ${page} (removed): ${formatBytes(size)}`);
    }
  });

  if (!hasSignificantChanges) {
    console.log('  No significant changes found.');
  }

  // Summary
  console.log('\n📝 Summary:');
  if (current.totalSize <= baseline.totalSize) {
    console.log('✅ Bundle size is unchanged or smaller after cleanup.');
  } else {
    console.log('⚠️ Bundle size has increased after cleanup.');
  }
}

async function main() {
  const bundleInfo = getBundleInfo();

  if (!bundleInfo) {
    return;
  }

  if (saveBaseline) {
    saveBaselineInfo(bundleInfo);
  } else {
    compareWithBaseline(bundleInfo);
  }
}

// Run the script
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
