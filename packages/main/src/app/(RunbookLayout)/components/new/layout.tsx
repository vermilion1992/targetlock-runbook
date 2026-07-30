import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function NewComponentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="BHA_SETUP">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
