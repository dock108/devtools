#!/usr/bin/env tsx
/**
 * Script to rename imports across the codebase
 * Usage: npx tsx scripts/rename-imports.ts <importName> <oldPath> <newPath>
 * Example: npx tsx scripts/rename-imports.ts "formatCurrency" "@/utils/formatCurrency" "@dock108/common"
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Get command line arguments
const importName = process.argv[2];
const oldPath = process.argv[3];
const newPath = process.argv[4];

if (!importName) {
  console.error('Error: Import name is required');
  console.error('Usage: npx tsx scripts/rename-imports.ts <importName> [oldPath] [newPath]');
  process.exit(1);
}

async function findAllTsFiles(): Promise<string[]> {
  const files = await glob('**/*.{ts,tsx}', {
    ignore: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'build/**',
      'out/**',
      'scripts/rename-imports.ts', // Skip this file
    ],
    cwd: process.cwd(),
  });

  return files;
}

async function searchAndReplaceImports(files: string[]): Promise<void> {
  let totalReplacements = 0;
  const modifiedFiles = new Set<string>();

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Search for import statements containing the import name
      let newContent = content;

      // Case 1: Import with oldPath specified
      if (oldPath && newPath) {
        // Match import statement from oldPath
        const importRegex = new RegExp(
          `import\\s+{[^}]*\\b${importName}\\b[^}]*}\\s+from\\s+['"]${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
          'g',
        );

        if (importRegex.test(content)) {
          // Replace the import path
          newContent = content.replace(importRegex, (match) => match.replace(oldPath, newPath));

          totalReplacements++;
          modifiedFiles.add(file);
        }
      } else {
        // Case 2: Just search for any import of the specified name
        const anyImportRegex = new RegExp(
          `import\\s+{[^}]*\\b${importName}\\b[^}]*}\\s+from\\s+['"][^'"]+['"]`,
          'g',
        );

        const matches = content.match(anyImportRegex);
        if (matches) {
          console.log(`Found in ${file}:`);
          matches.forEach((match) => console.log(`  ${match}`));
        }
      }

      // Write back if modified
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  console.log(`\nReplaced ${totalReplacements} imports in ${modifiedFiles.size} files`);
  if (modifiedFiles.size > 0) {
    console.log('\nModified files:');
    Array.from(modifiedFiles).forEach((file) => console.log(`- ${file}`));
  }
}

async function main() {
  console.log(`🔍 Searching for imports of "${importName}"...`);

  if (oldPath && newPath) {
    console.log(`Will replace imports from "${oldPath}" to "${newPath}"`);
  } else {
    console.log(`No replacement specified, just searching for usages`);
  }

  const files = await findAllTsFiles();
  console.log(`Scanning ${files.length} TypeScript files...`);

  await searchAndReplaceImports(files);
}

// Run the script
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
