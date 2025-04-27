#!/usr/bin/env tsx
/**
 * Cleanup script to consolidate utilities and remove legacy code
 * Run with: npx tsx scripts/cleanup.ts
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Define paths
const COMMON_DIR = path.join(process.cwd(), 'packages', 'common', 'src');
const UTILS_DIR = path.join(process.cwd(), 'lib', 'utils.ts');

async function main() {
  console.log('🧹 Starting codebase cleanup...');

  // 1. Ensure packages/common/src directory exists
  await ensureDirectoryExists(COMMON_DIR);

  // 2. Create common package if it doesn't exist
  await createCommonPackage();

  // 3. Create formatCurrency in common package
  await createFormatCurrencyUtil();

  // 4. Update utils.ts to include safeParseJson
  await addSafeParseJsonToUtils();

  // 5. Clean up legacy API routes (mentioned in deleted files)
  await cleanupLegacyApiRoutes();

  console.log('✅ Cleanup complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run lint && npm run test');
  console.log('2. Run: npm run build');
  console.log(
    '3. Commit changes: git commit -am "chore: remove legacy code and consolidate utilities"',
  );
}

async function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function createCommonPackage() {
  const packageJsonPath = path.join(process.cwd(), 'packages', 'common', 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log('Creating packages/common package.json');

    const packageJson = {
      name: '@dock108/common',
      version: '0.1.0',
      description: 'Common utilities for Dock108',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        test: 'vitest run',
      },
      dependencies: {
        'timeago.js': '^4.0.2',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
      },
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Create tsconfig.json
    const tsconfigPath = path.join(process.cwd(), 'packages', 'common', 'tsconfig.json');
    const tsconfig = {
      compilerOptions: {
        target: 'es2020',
        module: 'commonjs',
        declaration: true,
        outDir: './dist',
        strict: true,
        esModuleInterop: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', '**/*.test.ts'],
    };

    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

    // Create index.ts
    const indexPath = path.join(COMMON_DIR, 'index.ts');
    fs.writeFileSync(indexPath, `export * from './formatters';\n`);
  }
}

async function createFormatCurrencyUtil() {
  const formattersPath = path.join(COMMON_DIR, 'formatters.ts');

  console.log('Creating formatCurrency utility in common package');

  const content = `/**
 * Shared formatters for currency, dates, and other common formats
 */

/**
 * Format a number as USD currency
 * @param value - The value to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  options: Partial<Intl.NumberFormatOptions> = {}
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
  
  return formatter.format(value);
}

/**
 * Shared Intl formatters — create once, reuse everywhere.
 * Saves per-render instantiation cost.
 */
export const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
  dateStyle: 'short',
});

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
}); 
`;

  fs.writeFileSync(formattersPath, content);

  // Create a test file
  const testPath = path.join(COMMON_DIR, 'formatters.test.ts');
  const testContent = `import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats numbers as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });
    
    it('respects custom formatting options', () => {
      expect(formatCurrency(1234.56, { currency: 'EUR' })).toBe('€1,234.56');
    });
  });
});
`;

  fs.writeFileSync(testPath, testContent);
}

async function addSafeParseJsonToUtils() {
  const utilsPath = path.join(process.cwd(), 'lib', 'utils.ts');
  let utilsContent = '';

  try {
    utilsContent = fs.readFileSync(utilsPath, 'utf8');
  } catch (error) {
    console.error('Error reading utils.ts:', error);
    return;
  }

  console.log('Adding safeParseJson to utils.ts');

  // Check if safeParseJson already exists
  if (!utilsContent.includes('safeParseJson')) {
    const safeParseJsonCode = `
/**
 * Safely parse JSON without throwing exceptions
 * @param json - String to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed JSON or fallback
 */
export function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    return fallback;
  }
}
`;

    // Append to the file
    fs.writeFileSync(utilsPath, utilsContent + safeParseJsonCode);
  }
}

async function cleanupLegacyApiRoutes() {
  // List of API routes to remove
  const routesToRemove = [
    'app/api/alerts/[alertId]/notification-status/route.ts',
    'app/api/alerts/[alertId]/retry/route.ts',
  ];

  for (const route of routesToRemove) {
    const routePath = path.join(process.cwd(), route);
    if (fs.existsSync(routePath)) {
      console.log(`Removing legacy API route: ${route}`);
      fs.unlinkSync(routePath);
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Error during cleanup:', error);
  process.exit(1);
});
