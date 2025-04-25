import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllDocSlugs, getDocData } from '@/lib/docs';

// Generate static paths for all docs
export async function generateStaticParams() {
  const paths = await getAllDocSlugs();
  console.log('[generateStaticParams] Generated paths:', JSON.stringify(paths, null, 2));
  return paths.map((path) => path.params);
}

// Generate metadata for the page
export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata | undefined> {
  console.log('[generateMetadata] Received params:', params);
  const doc = await getDocData(params.slug);
  console.log('[generateMetadata] Doc data:', doc ? { title: doc.title, slug: doc.slug } : null);

  if (!doc) {
    return;
  }

  return {
    title: `${doc.title} | DOCK108 Docs`,
    description: doc.description || 'DOCK108 Documentation', // Fallback description
    // Add other metadata fields if needed (e.g., OpenGraph)
  };
}

// Render the doc page
export default async function DocPage({ params }: { params: { slug: string[] } }) {
  console.log('[DocPage] Rendering page for params:', params);
  const doc = await getDocData(params.slug);
  console.log('[DocPage] Fetched doc data:', doc ? { title: doc.title, slug: doc.slug, hasContent: !!doc.content } : null);

  if (!doc) {
    console.error('[DocPage] Doc not found, triggering 404 for slug:', params.slug.join('/'));
    notFound(); // Trigger 404 if doc not found
  }

  return (
    <article className="prose prose-slate dark:prose-invert max-w-none p-6 lg:p-8">
      <h1>{doc.title}</h1>
      {/* Render the compiled MDX content directly */}
      {doc.content}
    </article>
  );
} 