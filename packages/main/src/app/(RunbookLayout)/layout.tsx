import type { ReactNode } from "react";
import { Suspense } from "react";

import { RunbookShell } from "@/components/app-shell/runbook-shell";

interface RunbookLayoutProps {
  children: ReactNode;
}

export default function RunbookLayout({ children }: RunbookLayoutProps) {
  return (
    <Suspense
      fallback={
        <main id="main-content" className="target-lock min-h-dvh">
          {children}
        </main>
      }
    >
      <RunbookShell>{children}</RunbookShell>
    </Suspense>
  );
}
