import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function AdvanceCasingPermissionLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary
      route="CASING_SETUP"
    >
      {children}
    </PilotRoutePermissionBoundary>
  );
}
