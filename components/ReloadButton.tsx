'use client';

import { Button } from "@/components/ui/button";

export function ReloadButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button onClick={() => window.location.reload()} {...props}>
      {children}
    </Button>
  );
} 