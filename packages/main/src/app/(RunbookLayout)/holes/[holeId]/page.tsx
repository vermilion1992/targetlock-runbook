import { notFound, redirect } from "next/navigation";

import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { isRoutableHoleId } from "@/infrastructure/seed";

interface HolePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function HolePage({ params }: HolePageProps) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  redirect(runbookRoutes.currentHole(holeId));
}
