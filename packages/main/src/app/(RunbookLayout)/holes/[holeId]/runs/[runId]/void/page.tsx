import { notFound } from "next/navigation";

import { RunVoidForm } from "@/components/runs/run-void-form";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function VoidRunPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <RunVoidForm holeId={holeId} runId={runId} />;
}
