import { Container } from "@/components/Container";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Container className="pb-20">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[250px_1fr] gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Settings</h2>
            <nav className="flex flex-col space-y-1">
              <Link
                href="/stripe-guardian/settings/accounts"
                className="px-3 py-2 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition data-[current=true]:bg-slate-100 data-[current=true]:text-slate-900 font-medium text-sm"
                data-current={
                  typeof window !== "undefined" && window.location.pathname.includes('/accounts')
                }
              >
                Connected Accounts
              </Link>
              <Link
                href="/stripe-guardian/settings/alerts"
                className="px-3 py-2 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition data-[current=true]:bg-slate-100 data-[current=true]:text-slate-900 font-medium text-sm"
                data-current={
                  typeof window !== "undefined" && window.location.pathname.includes('/alerts')
                }
              >
                Alert Settings
              </Link>
              <Link
                href="/stripe-guardian/settings/webhooks"
                className="px-3 py-2 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition data-[current=true]:bg-slate-100 data-[current=true]:text-slate-900 font-medium text-sm"
                data-current={
                  typeof window !== "undefined" && window.location.pathname.includes('/webhooks')
                }
              >
                Webhooks
              </Link>
            </nav>
          </div>
          <div>
            {children}
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
} 