import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function PilotAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="PILOT_ADMIN">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
