import { notFound } from "next/navigation";

import { HoleOwnedRecordNotFound } from "@/components/holes/hole-owned-record-not-found";
import { RunDetail } from "@/components/runs/run-detail";
import {
  isRoutableHoleId,
  isSeedRunCompatibleWithHole,
} from "@/infrastructure/seed";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; runId: string }>;
}) {
  const { holeId, runId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  if (!isSeedRunCompatibleWithHole(holeId, runId)) {
    return <HoleOwnedRecordNotFound holeId={holeId} />;
  }
  return <RunDetail holeId={holeId} runId={runId} />;
}
