import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function ComponentAssignLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="COMPONENT_ASSIGN">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
