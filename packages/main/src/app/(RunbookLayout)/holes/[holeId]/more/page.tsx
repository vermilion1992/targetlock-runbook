import { notFound } from "next/navigation";

import { MorePreview } from "@/components/holes/more-preview";
import { targetLockStage2Seed } from "@/infrastructure/seed";

interface MorePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function MorePage({ params }: MorePageProps) {
  const { holeId } = await params;

  if (holeId !== targetLockStage2Seed.hole.name) {
    notFound();
  }

  return <MorePreview holeId={holeId} />;
}
