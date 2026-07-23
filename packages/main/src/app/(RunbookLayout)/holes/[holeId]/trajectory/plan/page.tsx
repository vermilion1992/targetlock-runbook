import { notFound } from "next/navigation";

import { TrajectoryPlanForm } from "@/components/trajectory/trajectory-plan-form";
import { isStage5HoleId } from "@/infrastructure/seed";

export default async function HoleTrajectoryPlanPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <TrajectoryPlanForm holeId={holeId} />;
}
