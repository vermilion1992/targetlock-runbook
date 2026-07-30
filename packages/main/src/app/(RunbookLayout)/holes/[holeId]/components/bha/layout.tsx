import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function BhaSetupLayout({ children }: { children: ReactNode }) {
  return (
    <PilotRoutePermissionBoundary route="INITIAL_BHA_SETUP">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
