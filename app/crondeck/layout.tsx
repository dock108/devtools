import { Toaster } from 'react-hot-toast';

export default function CrondeckLayout({
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