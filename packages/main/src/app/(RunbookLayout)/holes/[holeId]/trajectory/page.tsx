import { notFound } from "next/navigation";

import { TrajectoryDashboard } from "@/components/trajectory/trajectory-dashboard";
import { isStage5HoleId } from "@/infrastructure/seed";

export default async function HoleTrajectoryPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <TrajectoryDashboard holeId={holeId} />;
}
