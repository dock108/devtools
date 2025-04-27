import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Card, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import docsConfig from '@/lib/docs.config';

export const metadata: Metadata = {
  title: 'Stripe Guardian Documentation',
  description:
    'Learn how to use Stripe Guardian to protect your Stripe Connect platform from fraud',
};

export default function DocsPage() {
  return (
    <div className="max-w-full">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Stripe Guardian Documentation</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl">
          Learn how to integrate, configure, and manage Stripe Guardian to protect your Stripe
          Connect platform.
        </p>
      </div>

      <div className="space-y-12">
        {docsConfig.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">{group.title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <Card key={item.href} className="transition-colors hover:bg-muted/50">
                  <CardContent className="pt-6">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <CardDescription className="mt-2 text-base">{item.description}</CardDescription>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={item.href}
                      className="text-sm text-primary font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      Read more
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
