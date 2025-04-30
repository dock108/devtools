import { Metadata } from 'next';
import ContactForm from './ContactForm';
import { Container } from '@/components/ui/container';
import Link from 'next/link';

const supportEmail = process.env.NEXT_PUBLIC_FROM_EMAIL ?? 'support@dock108.ai';

export const metadata: Metadata = {
  title: 'Contact & Support - DOCK108',
  description: 'Get in touch with the DOCK108 team for questions, feedback, or support.',
};

export default function ContactPage() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Contact & Support</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Questions about DOCK108? We reply within 1-2 business days.
        </p>

        <div className="grid gap-8 mb-12">
          <div className="bg-slate-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Email Support</h2>
            <p className="mb-4">
              For direct inquiries, you can email our support team at{' '}
              <Link
                href={`mailto:${supportEmail}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {supportEmail}
              </Link>
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Contact Form</h2>
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
