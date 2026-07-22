import { notFound } from "next/navigation";

import { TimelinePreview } from "@/components/holes/timeline-preview";
import { targetLockStage4Seed } from "@/infrastructure/seed";

interface TimelinePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function TimelinePage({ params }: TimelinePageProps) {
  const { holeId } = await params;

  if (holeId !== targetLockStage4Seed.hole.name) {
    notFound();
  }

  return <TimelinePreview holeId={holeId} seed={targetLockStage4Seed} />;
}
