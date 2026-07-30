import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function ComponentChangeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="COMPONENT_CHANGE">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
