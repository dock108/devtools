import { Toaster } from 'react-hot-toast';

export default function NotaryCiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}

<Toaster position="bottom-right" /> 