import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";
import Link from 'next/link';

export const metadata = {
  title: "Connect your Stripe account | Dock108 Guardian",
  description: "Connect your Stripe account to Guardian to monitor payouts and receive fraud alerts.",
};

export default function OnboardPage() {
  return (
    <Container className="py-20">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-6">
          Connect your Stripe account
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Guardian needs access to your Stripe account to monitor payouts and help
          detect potential fraud. We'll only request the permissions needed to keep
          your account safe.
        </p>
        
        <div className="flex justify-center mb-10">
          <Button 
            asChild
            size="lg"
            className="bg-[#635BFF] hover:bg-[#5851EB]"
          >
            <Link href="/api/stripe/oauth/start">
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <path d="M7 4.75c0-.412.338-.75.75-.75h4.5c.412 0 .75.338.75.75v2.5a.75.75 0 01-1.5 0v-.75h-1.25v4.75a.75.75 0 01-1.5 0V6.5H7.75v.75a.75.75 0 01-1.5 0v-2.5z" />
                <path d="M3.75 4a.75.75 0 00-.75.75v7a.25.25 0 00.25.25h9.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 0112.75 13h-9.5A1.75 1.75 0 011.5 11.25v-7A1.75 1.75 0 013.25 2.5h1.5a.75.75 0 010 1.5h-1z" />
              </svg>
              Connect my Stripe account
            </Link>
          </Button>
        </div>
        
        <div className="text-sm text-slate-500 space-y-2">
          <p>
            We use Stripe Connect to securely link your account. Your credentials 
            are never shared with us directly.
          </p>
          <p>
            You can disconnect Guardian from your Stripe account at any time.
          </p>
        </div>
      </div>
    </Container>
  );
} 