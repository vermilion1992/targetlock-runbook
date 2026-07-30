import type { ReactNode } from "react";
import { Suspense } from "react";

import { RunbookShell } from "@/components/app-shell/runbook-shell";
import { RequireOperatorSession } from "@/components/session";
import { requirePilotPageSession } from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

interface RunbookLayoutProps {
  children: ReactNode;
}

export default async function RunbookLayout({ children }: RunbookLayoutProps) {
  await requirePilotPageSession("/start");
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
