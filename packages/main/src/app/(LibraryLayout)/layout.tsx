import type { ReactNode } from "react";

import { LibraryShell } from "@/components/app-shell/library-shell";
import { RequireOperatorSession } from "@/components/session";
import { requirePilotPageSession } from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export default async function ProjectLibraryLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePilotPageSession("/start");
  return (
    <RequireOperatorSession>
      <LibraryShell>{children}</LibraryShell>
    </RequireOperatorSession>
  );
}
