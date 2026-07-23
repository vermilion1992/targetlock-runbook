import { notFound } from "next/navigation";

import { TrajectorySetupForm } from "@/components/trajectory/trajectory-setup-form";
import { isStage5HoleId } from "@/infrastructure/seed";

export default async function HoleTrajectorySetupPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <TrajectorySetupForm holeId={holeId} />;
}
