import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewHoleForm } from "@/components/holes/new-hole-form";
import { requirePilotPageSession } from "@/server/pilot/runtime";

export const metadata: Metadata = {
  title: "Create Assigned Hole",
  description: "Create a Draft hole from a client plan for assigned field work.",
};

function first(value: string | string[] | undefined): string | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected?.trim() || null;
}

export default async function CreateAssignedHolePage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string | string[];
    rig?: string | string[];
  }>;
}) {
  const context = await requirePilotPageSession(
    "/start/new-hole",
    "CREATE_ASSIGNED_HOLE",
  );
  const search = await searchParams;
  const requestedProjectId = first(search.project);
  const requestedRigId = first(search.rig);
  const isPilotDriller = context?.principal.role === "DRILLER";
  const projectId = isPilotDriller
    ? context.device?.projectRef ?? null
    : requestedProjectId;
  const rigId = isPilotDriller ? context.device?.rigRef ?? null : requestedRigId;

  if (isPilotDriller && context.device === null) {
    redirect("/start?device=required");
  }
  if (!projectId || (isPilotDriller && !rigId)) {
    redirect("/start?error=configuration");
  }

  return (
    <NewHoleForm
      projectId={projectId}
      assignedRigId={rigId ?? undefined}
      sourceMode="client-plan"
    />
  );
}
