import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob'; // Using glob for pattern matching
import { compileMDX } from 'next-mdx-remote/rsc'; // Use RSC version
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
// Import components if needed for MDX rendering (optional)
// import { mdxComponents } from '@/components/MarkdownComponents'; // Reuse or create new

const DOCS_PATH = path.join(process.cwd(), 'docs');

export interface DocFrontmatter {
  title: string;
  description?: string;
  // Add other frontmatter fields as needed
}

export interface DocData extends DocFrontmatter {
  slug: string;
  url: string;
  content: any; // Type from compileMDX result
}

export interface DocPath {
  params: {
    slug: string[];
  };
}

// Get all slugs for static generation
export async function getAllDocSlugs(): Promise<DocPath[]> {
  const files = await glob('**/*.{md,mdx}', { cwd: DOCS_PATH });

  return files.map((file) => {
    const slugArray = file.replace(/\.(mdx|md)$/, '').split(path.sep);
    return {
      params: {
        slug: slugArray,
      },
    };
  });
}

// Get data for a single doc page
export async function getDocData(slugArray: string[]): Promise<DocData | null> {
  const slug = slugArray.join('/');
  const potentialPaths = [
    path.join(DOCS_PATH, `${slug}.mdx`),
    path.join(DOCS_PATH, `${slug}.md`),
  ];

  let fullPath: string | undefined;
  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      fullPath = p;
      break;
    }
  }

  if (!fullPath) {
    console.error(`Doc file not found for slug: ${slug}`);
    return null;
  }

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // Basic validation
    if (!data.title) {
      console.warn(`Doc ${slug} is missing required frontmatter: title.`);
      // Provide default or handle error
    }

    const frontmatter = data as DocFrontmatter;

    // Compile MDX content
    const compiledContent = await compileMDX<DocFrontmatter>({
      source: content,
      options: {
        parseFrontmatter: false, // We already parsed it with gray-matter
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug],
        },
      },
      // Pass components if you have custom styling/overrides
      // components: mdxComponents,
    });


    return {
      slug: slugArray.join('/'), // Keep original slug string too
      url: `/docs/${slugArray.join('/')}`,
      title: frontmatter.title || 'Untitled Document',
      description: frontmatter.description || '',
      content: compiledContent.content, // Return the compiled JSX
    };
  } catch (error) {
    console.error(`Error processing doc ${slug}:`, error);
    return null;
  }
}

// Get metadata for sidebar navigation (slug, title, potentially hierarchy)
// This needs refinement based on how we structure the sidebar
export interface NavItem {
    title: string;
    slug: string;
    url: string;
    // Optional: Add level or children for hierarchy
}

export async function getDocsNavigation(): Promise<NavItem[]> {
    const slugs = await getAllDocSlugs();
    const navItems: NavItem[] = [];

    for (const docPath of slugs) {
        const slug = docPath.params.slug.join('/');
        const potentialPaths = [
            path.join(DOCS_PATH, `${slug}.mdx`),
            path.join(DOCS_PATH, `${slug}.md`),
        ];
        let fullPath: string | undefined;
        for (const p of potentialPaths) {
            if (fs.existsSync(p)) {
            fullPath = p;
            break;
            }
        }

        if (fullPath) {
            try {
                const fileContents = fs.readFileSync(fullPath, 'utf8');
                const { data } = matter(fileContents);
                if (data.title) {
                    navItems.push({
                        title: data.title,
                        slug: slug,
                        url: `/docs/${slug}`,
                    });
                } else {
                     console.warn(`Doc ${slug} missing title for navigation.`);
                }
            } catch (error) {
                 console.error(`Error reading frontmatter for nav item ${slug}:`, error);
            }
        }
    }

    // Sort or structure navItems hierarchically here if needed
    // Example basic sort:
    navItems.sort((a, b) => a.url.localeCompare(b.url));

    return navItems;
} 