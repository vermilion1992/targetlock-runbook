import { notFound, redirect } from "next/navigation";

import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { targetLockStage1Seed } from "@/infrastructure/seed";

interface HolePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function HolePage({ params }: HolePageProps) {
  const { holeId } = await params;
  if (holeId !== targetLockStage1Seed.hole.name) {
    notFound();
  }

  redirect(runbookRoutes.currentHole(holeId));
}
