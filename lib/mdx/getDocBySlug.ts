import fs from 'fs/promises';
import path from 'path';
import { compileMDX } from 'next-mdx-remote/rsc';
import docsComponents from '@/components/mdx/docs';

interface DocFrontmatter {
  title?: string;
  description?: string;
  [key: string]: any;
}

/**
 * Gets an MDX file by its slug and compiles it
 * @param slug Array of path segments
 * @returns Compiled MDX content with frontmatter
 */
export async function getDocBySlug(slug: string[]) {
  try {
    // Join the slug segments with slashes and add .mdx extension
    const filePath = path.join(process.cwd(), 'content/docs', `${slug.join('/')}.mdx`);
    const source = await fs.readFile(filePath, 'utf8');

    // Compile the MDX content with our custom components
    const { content, frontmatter } = await compileMDX<DocFrontmatter>({
      source,
      components: docsComponents,
      options: {
        parseFrontmatter: true,
      },
    });

    return { content, frontmatter };
  } catch (error) {
    console.error(`Failed to load doc: ${slug.join('/')}`, error);
    return null;
  }
}

/**
 * Gets a list of all docs in the content/docs directory
 * @returns Array of doc slugs
 */
export async function getAllDocs() {
  try {
    const docsDir = path.join(process.cwd(), 'content/docs');
    const allFiles = await fs.readdir(docsDir, { withFileTypes: true, recursive: true });

    const docs = allFiles
      .filter((entry) => !entry.isDirectory() && entry.name.endsWith('.mdx'))
      .map((entry) => {
        // Remove the .mdx extension and convert path to slug array
        const relativePath = path.relative(docsDir, path.join(entry.path, entry.name));
        return relativePath.replace(/\.mdx$/, '').split(path.sep);
      });

    return docs;
  } catch (error) {
    console.error('Failed to get all docs', error);
    return [];
  }
}
