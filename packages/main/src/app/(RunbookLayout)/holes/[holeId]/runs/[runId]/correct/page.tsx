import { notFound } from "next/navigation";

import { RunCorrectionForm } from "@/components/runs/run-correction-form";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function CorrectRunPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <RunCorrectionForm holeId={holeId} runId={runId} />;
}
