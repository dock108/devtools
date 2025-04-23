import { Providers } from './providers';

export default function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
} 