import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import fs from 'node:fs/promises'; // Use node:fs
import path from 'node:path'; // Use node:path
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight'; // Or your preferred highlighter
import { getAllDocs, DocFrontmatter } from '@/lib/mdx/getDocBySlug'; // Adjust import if needed
import siteConfig from '@/lib/siteConfig';
import Alert from '@/components/ui/alert'; // Corrected path
// Import other components used via shortcodes

interface DocPageProps {
  params: { slug: string[] };
}

// Re-usable map for shortcode components
const shortcodeComponents = {
  // Map shortcode names (e.g., 'Alert' from :::alert Alert) to imported components
  Alert: Alert,
  // Add other shortcodes used in docs
};

// Custom component to handle ::: shortcodes (could be shared with blog)
const ShortCodeRenderer = ({ node, ..._ }: any) => {
  const match = /^:::(\w+)\s+(\w+)(?:\s+(.*))?/.exec(node?.children?.[0]?.value ?? '');
  if (!match) {
    return null;
  }
  const [, type, name, propsJson] = match;

  // Map type/name to component
  if (type === 'demo' || type === 'alert') {
    // Add other types as needed
    const Component = shortcodeComponents[name as keyof typeof shortcodeComponents];
    if (Component) {
      let parsedProps = {};
      try {
        if (propsJson) parsedProps = JSON.parse(propsJson);
      } catch (e) {
        console.error(`Invalid props JSON for shortcode ${name}: ${propsJson}`, e);
      }
      // @ts-expect-error Spread works
      return <Component {...parsedProps} />;
    }
  }
  console.warn(`Unrecognized shortcode: :::${type} ${name}`);
  return null;
};

// Map Markdown elements to React components
const markdownComponentsMap = {
  // Handle shortcodes via the <pre> tag
  pre: ShortCodeRenderer,
  // Potentially handle `code` for syntax highlighting interaction
};

// Generate static paths for all docs
export async function generateStaticParams() {
  const docs = await getAllDocs(); // Ensure getAllDocs is async
  return docs.map((slugArray) => ({
    slug: slugArray,
  }));
}

// Generate metadata for the page
export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const slug = params.slug;
  try {
    const filePath = path.join(process.cwd(), 'content/docs', `${slug.join('/')}.md`);
    const file = await fs.readFile(filePath, 'utf8');
    const { data } = matter(file);
    const doc = data as DocFrontmatter;

    return {
      title: doc.title
        ? `${doc.title} - ${siteConfig.name} Docs`
        : `${siteConfig.name} Documentation`,
      description: doc.description || `${siteConfig.name} Documentation`,
      // Add other metadata as needed
    };
  } catch (error) {
    console.error(`Metadata generation failed for docs/${slug.join('/')}:`, error);
    return { title: 'Doc not found' };
  }
}

// Render the doc page
export default async function DocPage({ params }: DocPageProps) {
  const slug = params.slug;
  let fileContent: string;
  try {
    const filePath = path.join(process.cwd(), 'content/docs', `${slug.join('/')}.md`);
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.error(`Doc not found: ${slug.join('/')}`, error);
    notFound();
  }

  const { content: markdownContent, data: frontmatter } = matter(fileContent);
  const doc = frontmatter as DocFrontmatter;

  return (
    // Add appropriate layout/styling container if needed
    <div className="prose prose-slate max-w-none py-8">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">{doc.title || 'Documentation'}</h1>
      {doc.description && <p className="text-xl text-muted-foreground mb-8">{doc.description}</p>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]} // Ensure highlighter styles loaded
        components={markdownComponentsMap} // Use the combined map
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
}
