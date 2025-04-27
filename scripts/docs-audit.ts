#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const DOCS_DIR = path.join(process.cwd(), 'docs/guardian');
const OUTPUT_MD = path.join(DOCS_DIR, 'README_PUBLIC_MAP.md');
const OUTPUT_CSV = path.join(DOCS_DIR, 'public_map.csv');

// File classification patterns
const INTERNAL_PATTERNS = [
  /schema/i,
  /ER diagram/i,
  /entity relationship/i,
  /migrations\/\d+/i,
  /migration sql/i,
  /sql /i,
  /supabase/i,
  /env var/i,
  /environment variable/i,
  /webhook_secret/i,
  /api key/i,
  /access token/i,
  /RLS/i,
  /Row-Level Security/i,
  /policy/i,
];

interface DocFile {
  filename: string;
  relativePath: string;
  status: 'Public' | 'Internal' | 'Mixed';
  reason: string;
}

function classifyFile(filePath: string): DocFile {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  const relativePath = path.relative(DOCS_DIR, filePath);

  // Skip non-markdown files
  if (!filename.endsWith('.md') && !filename.endsWith('.mdx')) {
    return {
      filename,
      relativePath,
      status: 'Internal', // Default non-markdown to internal
      reason: 'Not a markdown file',
    };
  }

  // Check for internal patterns
  const internalMatches = INTERNAL_PATTERNS.filter((pattern) => pattern.test(content));

  // Specific file overrides based on content/filename
  if (filename === 'onboarding.md') {
    return {
      filename,
      relativePath,
      status: 'Mixed',
      reason: 'Contains schema information, but public user flow info',
    };
  }

  if (filename === 'security.md') {
    return {
      filename,
      relativePath,
      status: 'Internal',
      reason: 'Contains RLS policies and security model details',
    };
  }

  // Default classification logic
  if (internalMatches.length === 0) {
    return {
      filename,
      relativePath,
      status: 'Public',
      reason: 'No sensitive content detected',
    };
  } else if (internalMatches.length > 0 && content.includes('## ')) {
    // If it has internal patterns but also has sections (## headings), consider it mixed
    return {
      filename,
      relativePath,
      status: 'Mixed',
      reason: `Contains sections with sensitive content: ${internalMatches[0].toString().replace(/\//g, '')}`,
    };
  } else {
    return {
      filename,
      relativePath,
      status: 'Internal',
      reason: `Contains sensitive content: ${internalMatches[0].toString().replace(/\//g, '')}`,
    };
  }
}

function walkDirectory(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function generateMarkdownTable(docFiles: DocFile[]): string {
  const header = `# Stripe Guardian Documentation Public/Private Map

This file classifies all documentation files in the \`docs/guardian\` directory as:

- **Public**: Can be published as-is to external documentation
- **Internal**: Contains sensitive information and should not be published
- **Mixed**: Contains both public and sensitive sections that need redaction

## Files Classification

| File | Status | Action |
|------|--------|--------|
`;

  const rows = docFiles
    .map((file) => {
      let action = '';

      switch (file.status) {
        case 'Public':
          action = 'Keep entire file';
          break;
        case 'Internal':
          action = 'Do not publish';
          break;
        case 'Mixed':
          action = `Redact sensitive sections (${file.reason.replace('Contains sections with sensitive content: ', '')})`;
          break;
      }

      return `| ${file.relativePath} | ${file.status} | ${action} |`;
    })
    .join('\n');

  return header + rows;
}

function generateCSV(docFiles: DocFile[]): string {
  const header = 'file,status,reason,action\n';

  const rows = docFiles
    .map((file) => {
      let action = '';

      switch (file.status) {
        case 'Public':
          action = 'Keep entire file';
          break;
        case 'Internal':
          action = 'Do not publish';
          break;
        case 'Mixed':
          action = `Redact sensitive sections (${file.reason.replace('Contains sections with sensitive content: ', '')})`;
          break;
      }

      // Escape any commas in the fields
      const escapedReason = file.reason.replace(/"/g, '""');
      const escapedAction = action.replace(/"/g, '""');

      return `"${file.relativePath}","${file.status}","${escapedReason}","${escapedAction}"`;
    })
    .join('\n');

  return header + rows;
}

function main() {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      console.error(`Error: Directory ${DOCS_DIR} does not exist.`);
      process.exit(1);
    }

    // Get all files in the directory
    const files = walkDirectory(DOCS_DIR);

    // Filter out system files and non-documents
    const docFiles = files
      .filter((file) => !path.basename(file).startsWith('.')) // Skip hidden files
      .map(classifyFile)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // Generate Markdown table and save it
    const markdownTable = generateMarkdownTable(docFiles);
    fs.writeFileSync(OUTPUT_MD, markdownTable);

    // Generate CSV and save it
    const csv = generateCSV(docFiles);
    fs.writeFileSync(OUTPUT_CSV, csv);

    // Output to console
    console.log(markdownTable);
    console.log('\nALL FILES ACCOUNTED FOR');

    console.log(`\nOutput saved to:
- ${OUTPUT_MD}
- ${OUTPUT_CSV}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
