import type { ReactNode } from "react";

import { PilotPermissionBoundary } from "@/server/pilot/permission-boundary";

export default function CompleteHoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotPermissionBoundary permission="HOLE_COMPLETE">
      {children}
    </PilotPermissionBoundary>
  );
}
