import type { ReactNode } from "react";

import { PilotPermissionBoundary } from "@/server/pilot/permission-boundary";

export default function ReopenHoleLayout({ children }: { children: ReactNode }) {
  return (
    <PilotPermissionBoundary permission="HOLE_REOPEN">
      {children}
    </PilotPermissionBoundary>
  );
}
