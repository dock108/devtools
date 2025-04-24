// Remove Header, Footer, Toaster, and wrapping div
// The root layout now handles these

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>; // Just pass children through
} 
 
 
 
 