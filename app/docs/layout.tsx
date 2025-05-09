import { Metadata } from 'next';
import { SidebarNavClient } from '@/components/docs/SidebarNav';
import { MobileNavClient } from '@/components/docs/MobileNav';
import docsConfig from '@/lib/docs.config';

interface DocsLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: {
    default: 'DOCK108 Documentation',
    template: `%s | DOCK108 Docs`,
  },
  description:
    'Documentation for DOCK108 developer tools.',
};

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background lg:hidden">
        <div className="container flex h-14 items-center">
          <MobileNavClient />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Docs</h1>
            </div>
          </div>
        </div>
      </header>
      <div className="container flex-1 items-start md:grid md:grid-cols-[250px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block lg:py-6">
          <SidebarNavClient />
        </aside>
        <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] prose prose-dock lg:prose-lg max-w-3xl mx-auto">
          <div className="">
            <div className="pb-12 pt-4">
              <div className="">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
