import type { ReactNode } from "react";

import { PilotPermissionBoundary } from "@/server/pilot/permission-boundary";

export default function CorrectCasingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotPermissionBoundary permission="RECORD_CORRECTION">
      {children}
    </PilotPermissionBoundary>
  );
}
