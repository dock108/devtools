import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import fs from 'node:fs/promises'; // Use node:fs
import path from 'node:path'; // Use node:path
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight'; // Or your preferred highlighter
import { getAllPosts, getPostBySlug, getPrevNextPosts, PostFrontMatter } from '@/lib/blog'; // Assuming PostFrontMatter is exported
import { Container } from '@/components/Container';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import siteConfig from '@/lib/siteConfig';
import DemoCTA from '@/components/mdx/DemoCTA'; // Keep for mapping
import Alert from '@/components/ui/alert'; // Corrected path

interface BlogPostPageProps {
  params: { slug: string };
}

// Re-usable map for shortcode components
const shortcodeComponents = {
  DemoCTA: DemoCTA,
  Alert: Alert, // Map the 'Alert' shortcode name to the Alert component
  // Add other shortcodes here
};

// Custom component to handle ::: shortcodes
const ShortCodeRenderer = ({ node, ...props }: any) => {
  // Attempt to parse the shortcode syntax: :::type Name optionalPropsJson
  const match = /^:::(\w+)\s+(\w+)(?:\s+(.*))?/.exec(node?.children?.[0]?.value ?? '');
  if (!match) {
    // If it doesn't match our syntax, render the original <pre> content or nothing
    // return <pre {...props} />; // Option 1: show the original code block
    return null; // Option 2: hide unrecognized blocks
  }

  const [, type, name, propsJson] = match;

  // Currently only handling type 'demo' and 'alert'
  if (type === 'demo' || type === 'alert') {
    const Component = shortcodeComponents[name as keyof typeof shortcodeComponents];
    if (Component) {
      let parsedProps = {};
      try {
        // Basic JSON parsing for props (use with caution or implement safer parsing)
        if (propsJson) {
          parsedProps = JSON.parse(propsJson);
        }
      } catch (e) {
        console.error(`Invalid props JSON for shortcode ${name}: ${propsJson}`, e);
      }
      // @ts-ignore Spread works
      return <Component {...parsedProps} />;
    }
  }

  // Fallback for unrecognized shortcode types/names
  console.warn(`Unrecognized shortcode: :::${type} ${name}`);
  return null;
};

// Map Markdown elements to React components (including shortcode handler)
const markdownComponentsMap = {
  // Customize standard elements if needed (e.g., img, a, etc.)
  // img: (props: any) => <img {...props} className="rounded-lg" alt={props.alt || ''} />, // Example

  // Handle the <pre> element where Rehype typically puts code blocks
  // and potentially our shortcode syntax if not parsed correctly earlier.
  pre: ShortCodeRenderer,
  // You might need `code` handling depending on highlighter and shortcode interaction
  // code: ({node, inline, className, children, ...props}: any) => { ... }
};

// Generate static paths
export async function generateStaticParams() {
  const posts = await getAllPosts(); // Ensure getAllPosts is async if it reads files
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  // Read file content to get frontmatter for metadata
  try {
    const filePath = path.join(process.cwd(), 'content/blog', `${params.slug}.md`);
    const file = await fs.readFile(filePath, 'utf8');
    const { data } = matter(file);
    const post = data as PostFrontMatter;

    const ogImageUrl = post.image
      ? `${siteConfig.url}${post.image}`
      : `${siteConfig.url}/api/og?title=${encodeURIComponent(post.title)}`;

    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: 'article',
        publishedTime: post.date,
        url: `${siteConfig.url}/blog/${params.slug}`,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: post.excerpt,
        images: [ogImageUrl],
      },
    };
  } catch (error) {
    console.error(`Metadata generation failed for blog/${params.slug}:`, error);
    return { title: 'Post not found' };
  }
}

// Render the blog post page
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  let fileContent: string;
  try {
    const filePath = path.join(process.cwd(), 'content/blog', `${params.slug}.md`);
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.error(`Blog post not found: ${params.slug}`, error);
    notFound(); // Trigger 404 if file doesn't exist
  }

  const { content: markdownContent, data: frontmatter } = matter(fileContent);
  const post = frontmatter as PostFrontMatter;

  // Fetch prev/next based on the current slug
  const { prev, next } = getPrevNextPosts(params.slug);

  return (
    <Container className="py-12 md:py-16 max-w-3xl mx-auto">
      <article>
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {/* Reading time might need recalculation if not stored/passed */}
            {/* <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime} 
            </span> */}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]} // Ensure highlighter styles are loaded globally
            components={markdownComponentsMap}
          >
            {markdownContent}
          </ReactMarkdown>
        </div>

        {/* Footer Navigation */}
        <footer className="mt-12 pt-8 border-t">
          <div className="flex justify-between gap-8">
            {/* Prev/Next links - ensure prev/next have slug property */}
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="text-left p-4 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors w-1/2"
              >
                <div className="text-xs text-muted-foreground mb-1 flex items-center">
                  <ArrowLeft className="h-3 w-3 mr-1" /> Previous
                </div>
                <div className="font-medium line-clamp-2">{prev.title}</div>
              </Link>
            ) : (
              <div className="w-1/2"></div>
            )}
            {next ? (
              <Link
                href={`/blog/${next.slug}`}
                className="text-right p-4 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors w-1/2"
              >
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-end">
                  Next <ArrowRight className="h-3 w-3 ml-1" />
                </div>
                <div className="font-medium line-clamp-2">{next.title}</div>
              </Link>
            ) : (
              <div className="w-1/2"></div>
            )}
          </div>
        </footer>
      </article>
    </Container>
  );
}
