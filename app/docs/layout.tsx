import { Sidebar } from '@/components/DocsSidebar';
import { getDocsNavigation } from '@/lib/docs';

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = await getDocsNavigation(); // Fetch nav items

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} />
      <main className="flex-1 overflow-y-auto">
        {/* Main content area where page.tsx will render */}
        {children}
      </main>
    </div>
  );
} 