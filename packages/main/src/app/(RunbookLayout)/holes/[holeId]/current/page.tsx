import { notFound } from "next/navigation";

import { CurrentHoleDashboard } from "@/components/holes/current-hole-dashboard";
import {
  isRoutableHoleId,
  targetLockStage4Seed,
} from "@/infrastructure/seed";

interface CurrentHolePageProps {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}

export default async function CurrentHolePage({
  params,
  searchParams,
}: CurrentHolePageProps) {
  const [{ holeId }, query] = await Promise.all([params, searchParams]);

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  return (
    <CurrentHoleDashboard
      holeId={holeId}
      seed={targetLockStage4Seed}
      notice={
        query.notice === "shift-started" ||
        query.notice === "handover-accepted" ||
        query.notice === "final-shift-closed" ||
        query.notice === "survey-saved" ||
        query.notice === "tray-saved" ||
        query.notice === "hole-completed" ||
        query.notice === "hole-reopened"
          ? query.notice
          : undefined
      }
    />
  );
}
