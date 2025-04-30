import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Card, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import docsConfig from '@/lib/docs.config';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = {
  title: 'DOCK108 Documentation',
  description:
    'Learn how to use DOCK108 tools and integrate them into your workflow.',
};

export default function DocsIndexPage() {
  return (
    <Container className="py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight">DOCK108 Documentation</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Learn how to integrate, configure, and manage DOCK108 tools.
          Select a topic from the sidebar to get started.
        </p>
        {/* Optionally add links to main doc sections if needed */}
        {/* <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/docs/crondeck/getting-started" className="block p-4 border rounded hover:bg-accent">
            <h2 className="font-semibold">CronDeck</h2>
            <p className="text-sm text-muted-foreground">Monitor your cron jobs.</p>
          </Link>
          Add other product links here
        </div> */}
      </div>
    </Container>
  );
}
