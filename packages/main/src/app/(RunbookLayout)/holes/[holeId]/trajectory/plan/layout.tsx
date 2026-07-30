import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function TrajectoryPlanLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="TRAJECTORY_PLAN">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
