import type { ReactNode } from "react";
import { Suspense } from "react";

import { RunbookShell } from "@/components/app-shell/runbook-shell";
import { RequireOperatorSession } from "@/components/session";

interface RunbookLayoutProps {
  children: ReactNode;
}

export default function RunbookLayout({ children }: RunbookLayoutProps) {
  return (
    <RequireOperatorSession>
      <Suspense
        fallback={
          <main id="main-content" className="target-lock min-h-dvh">
            <p role="status" className="p-5 font-semibold">
              Opening runbook…
            </p>
          </main>
        }
      >
        <RunbookShell>{children}</RunbookShell>
      </Suspense>
    </RequireOperatorSession>
  );
}
