import { notFound } from "next/navigation";

import { HoleAnalyticsDashboard } from "@/components/holes/hole-analytics-dashboard";
import { isStage5HoleId } from "@/infrastructure/seed";

export default async function HoleStatisticsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <HoleAnalyticsDashboard holeId={holeId} />;
}
