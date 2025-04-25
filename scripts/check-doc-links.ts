import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import type { Root, Link as MdLink } from 'mdast'; // Import specific types

const DOCS_PATH = path.join(process.cwd(), 'docs');
const VALID_URL_PREFIX = '/docs/';

interface LinkInfo {
  url: string;
  text: string;
  filePath: string;
  // Add position if needed later
}

async function getAllDocSlugsSet(): Promise<Set<string>> {
  const files = await glob('**/*.{md,mdx}', { cwd: DOCS_PATH });
  const slugs = files.map((file) => 
    path.join(VALID_URL_PREFIX, file.replace(/\.(mdx|md)$/, '').replace(/\\/g, '/'))
  );
  // Add index paths if they exist (e.g., /docs/section/ for section/index.md)
  files.forEach(file => {
      if (path.basename(file).match(/^index\.(md|mdx)$/i)) {
          const indexSlug = path.join(VALID_URL_PREFIX, path.dirname(file).replace(/\\/g, '/'));
          // Add both /docs/section and /docs/section/index
          slugs.push(indexSlug);
          slugs.push(`${indexSlug}/index`);
      }
  });
  return new Set(slugs);
}

async function findMarkdownLinks(filePath: string): Promise<LinkInfo[]> {
  const content = fs.readFileSync(filePath, 'utf8');
  const links: LinkInfo[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx) // Enable MDX syntax
    .use(remarkFrontmatter, ['yaml', 'toml']); // Support frontmatter

  const tree = processor.parse(content) as Root;

  visit(tree, 'link', (node: MdLink) => {
    if (node.url) {
        // Basic check for relative internal links starting with /
        if (node.url.startsWith('/') || node.url.startsWith('./') || node.url.startsWith('../')) {
            links.push({
                url: node.url,
                // Extract text content from children (simplified)
                text: node.children.map((child: any) => child.value || '').join(''),
                filePath: path.relative(process.cwd(), filePath),
            });
        }
    }
  });

  return links;
}

async function checkLinks() {
  console.log('🔍 Checking internal documentation links...');
  const docFiles = await glob('**/*.{md,mdx}', { cwd: DOCS_PATH, absolute: true });
  const validSlugs = await getAllDocSlugsSet();
  let brokenLinks: LinkInfo[] = [];
  let allLinks: LinkInfo[] = [];

  for (const file of docFiles) {
    const linksInFile = await findMarkdownLinks(file);
    allLinks = allLinks.concat(linksInFile);
  }

  console.log(`🔎 Found ${allLinks.length} potential internal links in ${docFiles.length} files.`);

  for (const link of allLinks) {
    let targetUrl = link.url;
    
    // Resolve relative paths based on the source file
    if (!targetUrl.startsWith('/')) {
        const sourceDir = path.dirname(link.filePath);
        targetUrl = path.resolve('/', sourceDir, targetUrl).replace(/\\/g, '/'); // Resolve relative to docs root
    }

    // Normalize URL: remove trailing slashes, anchors, query params for lookup
    const normalizedUrl = targetUrl.split('#')[0].split('?')[0].replace(/\/?$/, '');
    const normalizedUrlWithIndex = `${normalizedUrl}/index`; // Check for /docs/section/index

    // Check only links starting with /docs/
    if (normalizedUrl.startsWith(VALID_URL_PREFIX)) {
        if (!validSlugs.has(normalizedUrl) && !validSlugs.has(normalizedUrlWithIndex)) {
            brokenLinks.push({ ...link, url: targetUrl }); // Report original URL
        }
    }
  }

  if (brokenLinks.length > 0) {
    console.error(`\n🚨 Found ${brokenLinks.length} broken internal links:`);
    brokenLinks.forEach(link => {
      console.error(`  - File: ${link.filePath}`);
      console.error(`    Link Text: "${link.text}"`);
      console.error(`    Target URL: "${link.url}" (Resolved/Normalized check failed for: "${link.url.split('#')[0].split('?')[0].replace(/\/?$/, '')}")`);
    });
    console.error('\nPlease fix the links above.');
    process.exit(1); // Exit with error code
  } else {
    console.log('✅ All internal documentation links appear valid!');
  }
}

checkLinks().catch(err => {
    console.error("Error running link checker:", err);
    process.exit(1);
}); 