import { notFound, redirect } from "next/navigation";

import { targetLockStage1Seed } from "@/infrastructure/seed";

interface RunsPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { holeId } = await params;
  if (holeId !== targetLockStage1Seed.hole.name) {
    notFound();
  }

  redirect(`/holes/${encodeURIComponent(holeId)}/runs/new`);
}
