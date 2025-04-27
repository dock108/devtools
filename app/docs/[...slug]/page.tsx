import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getDocBySlug } from '@/lib/mdx/getDocBySlug';

interface DocPageProps {
  params: {
    slug: string[];
  };
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const doc = await getDocBySlug(params.slug);

  if (!doc) {
    return {
      title: 'Documentation Not Found',
    };
  }

  return {
    title: doc.frontmatter?.title
      ? `${doc.frontmatter.title} - Stripe Guardian Docs`
      : 'Stripe Guardian Documentation',
    description: doc.frontmatter?.description || 'Stripe Guardian Documentation',
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const doc = await getDocBySlug(params.slug);

  if (!doc) {
    notFound();
  }

  return (
    <>
      {/* <h1 className="mb-4 text-4xl font-bold tracking-tight">
        {doc.frontmatter?.title || 'Documentation'}
      </h1>
      {doc.frontmatter?.description && (
        <p className="text-xl text-muted-foreground mb-8">{doc.frontmatter.description}</p>
      )} */}
      <div>{doc.content}</div>
    </>
  );
}
