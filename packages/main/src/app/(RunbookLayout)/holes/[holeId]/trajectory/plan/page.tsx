import { notFound, redirect } from "next/navigation";

import { runbookRoutes } from "@/components/navigation/runbook-routes";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function HoleTrajectoryPlanPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  redirect(runbookRoutes.trajectory(holeId));
}
