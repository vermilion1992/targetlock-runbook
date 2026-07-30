import type { ReactNode } from "react";

import { RequireSupervisorSession } from "@/components/session";
import { requirePilotPageSession } from "@/server/pilot/runtime";

export const dynamic = "force-dynamic";

export default async function ProjectsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePilotPageSession("/projects", "PROJECT_SETUP");
  return <RequireSupervisorSession>{children}</RequireSupervisorSession>;
}
