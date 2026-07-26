import { notFound } from "next/navigation";

import { HoleOwnedRecordNotFound } from "@/components/holes/hole-owned-record-not-found";
import { RunVoidForm } from "@/components/runs/run-void-form";
import {
  isRoutableHoleId,
  isSeedRunCompatibleWithHole,
} from "@/infrastructure/seed";

export default async function VoidRunPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  if (!isSeedRunCompatibleWithHole(holeId, runId)) {
    return <HoleOwnedRecordNotFound holeId={holeId} />;
  }
  return <RunVoidForm holeId={holeId} runId={runId} />;
}
