import template, { size as OG_SIZE } from '@/lib/og-template';
import { getPostData } from '@/lib/blog';
import { notFound } from 'next/navigation';

export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function blogPostOg({ params }: { params: { slug: string } }) {
  const post = await getPostData(params.slug);
  if (!post) return notFound();
  return template({
    title: post.title,
    subtitle: post.description,
    accent: '#101827',
  });
} 