import { notFound } from "next/navigation";

import { RunDetail } from "@/components/runs/run-detail";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <RunDetail holeId={holeId} runId={runId} />;
}
