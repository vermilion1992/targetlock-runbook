import { redirect } from "next/navigation";

import { targetLockStage5Seed } from "@/infrastructure/seed";

export default function NewHolePage() {
  redirect(
    `/projects/${encodeURIComponent(targetLockStage5Seed.project.localId)}/holes/new`,
  );
}
