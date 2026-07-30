import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function SurveyToolsLayout({ children }: { children: ReactNode }) {
  return (
    <PilotRoutePermissionBoundary route="SURVEY_TOOL_SETUP">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
