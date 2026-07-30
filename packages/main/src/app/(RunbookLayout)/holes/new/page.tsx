import { redirect } from "next/navigation";

import { targetLockStage5Seed } from "@/infrastructure/seed";
import { readPilotEnvironment } from "@/server/pilot/environment";

export default function NewHolePage() {
  if (readPilotEnvironment().mode === "pilot") {
    redirect("/projects");
  }
  redirect(
    `/projects/${encodeURIComponent(targetLockStage5Seed.project.localId)}/holes/new`,
  );
}
