// import { Header } from "@/components/Header";
// import { Footer } from "@/components/Footer";

export default function GuardianDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Remove Header component */}
      {children}
      {/* Remove Footer component */}
    </>
  );
} 