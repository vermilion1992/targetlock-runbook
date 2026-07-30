import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function TrajectorySetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="TRAJECTORY_SETUP">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
