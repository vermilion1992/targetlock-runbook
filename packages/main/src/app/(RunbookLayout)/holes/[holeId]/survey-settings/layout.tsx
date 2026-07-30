import type { ReactNode } from "react";

import { PilotRoutePermissionBoundary } from "@/server/pilot/permission-boundary";

export default function SurveySettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PilotRoutePermissionBoundary route="SURVEY_SETTINGS">
      {children}
    </PilotRoutePermissionBoundary>
  );
}
