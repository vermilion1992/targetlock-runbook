import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function NewHoleLayout({ children }: { children: ReactNode }) {
  return (
    <PilotRoutePermissionBoundary route="NEW_HOLE">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
