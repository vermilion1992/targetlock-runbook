import { notFound } from "next/navigation";

import { RunbookPreview } from "@/components/holes/runbook-preview";
import { targetLockStage2Seed } from "@/infrastructure/seed";

interface RunbookPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function RunbookPage({ params }: RunbookPageProps) {
  const { holeId } = await params;

  if (holeId !== targetLockStage2Seed.hole.name) {
    notFound();
  }

  return <RunbookPreview holeId={holeId} />;
}
