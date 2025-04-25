// import { redirect } from 'next/navigation';
import { getDocsNavigation, NavItem } from '@/lib/docs';
import Link from 'next/link';

// This page component displays the list of documentation pages
export default async function DocsIndexPage() {
  const navigation = await getDocsNavigation();

  if (!navigation || navigation.length === 0) {
    // Handle the case where no docs are found
    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">Documentation</h1>
            <p className="text-muted-foreground">No documentation pages found.</p>
        </div>
    );
  }

  // Simple list rendering for now
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Documentation Index</h1>
      <ul className="space-y-2">
        {navigation.map((item: NavItem) => (
          <li key={item.slug}>
            <Link href={item.url} className="text-lg text-primary hover:underline">
              {item.title}
            </Link>
            {/* Optionally add description if available in NavItem */}
          </li>
        ))}
      </ul>
    </div>
  );
} 