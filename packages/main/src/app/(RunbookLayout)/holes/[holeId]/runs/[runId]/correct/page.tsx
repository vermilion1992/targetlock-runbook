import { notFound } from "next/navigation";

import { HoleOwnedRecordNotFound } from "@/components/holes/hole-owned-record-not-found";
import { RunCorrectionForm } from "@/components/runs/run-correction-form";
import {
  isRoutableHoleId,
  isSeedRunCompatibleWithHole,
} from "@/infrastructure/seed";

export default async function CorrectRunPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  if (!isSeedRunCompatibleWithHole(holeId, runId)) {
    return <HoleOwnedRecordNotFound holeId={holeId} />;
  }
  return <RunCorrectionForm holeId={holeId} runId={runId} />;
}
