#!/usr/bin/env node

/**
 * Documentation Linter
 *
 * This script checks documentation files for sensitive content
 * that shouldn't be included in public-facing docs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const globPromise = promisify(glob);

// Patterns to check for in docs
const sensitivePatterns = [
  {
    pattern: /CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE/i,
    message: 'SQL DDL statements are not allowed in public docs',
  },
  {
    pattern: /\"type\"\s*:\s*\"[^\"]+\",\s*\"object\"\s*:/,
    message: 'Full JSON webhook payloads should not be included in public docs',
  },
  {
    pattern: /supabase\.rpc\(|supabase\.from\(/,
    message: 'Supabase API calls should not be included in public docs',
  },
  {
    pattern: /create\s+policy|alter\s+policy|drop\s+policy/i,
    message: 'Supabase RLS policy definitions should not be included in public docs',
  },
  {
    pattern: /[A-Z_]{10,}=([\"'][^\"\'\s]{8,})/,
    message: 'Environment variable values should be masked with **** in public docs',
  },
  {
    pattern: /schema\.prisma|schema\.sql|ER diagram/i,
    message: 'Schema definitions or ER diagrams should not be included in public docs',
  },
];

// Function to check a file for sensitive content
async function checkFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const issues = [];

    sensitivePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        issues.push({ message, filePath });
      }
    });

    return issues;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [{ message: `Error reading file: ${error.message}`, filePath }];
  }
}

// Main function to check all doc files
async function main() {
  try {
    const docFiles = await globPromise('content/docs/**/*.mdx');

    console.log(`Checking ${docFiles.length} documentation files for sensitive content...`);

    const allIssuesPromises = docFiles.map(checkFile);
    const allIssuesArrays = await Promise.all(allIssuesPromises);
    const allIssues = allIssuesArrays.flat();

    if (allIssues.length === 0) {
      console.log('✅ No sensitive content found in documentation files');
      process.exit(0);
    } else {
      console.error(`❌ Found ${allIssues.length} issues in documentation files:`);

      // Group issues by file
      const issuesByFile = {};
      allIssues.forEach((issue) => {
        if (!issuesByFile[issue.filePath]) {
          issuesByFile[issue.filePath] = [];
        }
        issuesByFile[issue.filePath].push(issue.message);
      });

      // Print issues grouped by file
      Object.entries(issuesByFile).forEach(([filePath, messages]) => {
        console.error(`\nIn ${filePath}:`);
        messages.forEach((message) => {
          console.error(`  - ${message}`);
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
