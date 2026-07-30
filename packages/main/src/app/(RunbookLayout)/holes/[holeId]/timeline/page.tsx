import { notFound } from "next/navigation";

import { TimelinePreview } from "@/components/holes/timeline-preview";
import {
  isRoutableHoleId,
  targetLockStage4Seed,
} from "@/infrastructure/seed";
import { readPilotEnvironment } from "@/server/pilot/environment";

interface TimelinePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function TimelinePage({ params }: TimelinePageProps) {
  const { holeId } = await params;

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  return (
    <TimelinePreview
      holeId={holeId}
      seed={
        readPilotEnvironment().mode === "demo" ? targetLockStage4Seed : null
      }
    />
  );
}
