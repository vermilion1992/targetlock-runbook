import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function NewCasingPermissionLayout({
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
