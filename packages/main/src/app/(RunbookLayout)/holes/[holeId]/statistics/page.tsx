import { notFound } from "next/navigation";

import { HoleAnalyticsDashboard } from "@/components/holes/hole-analytics-dashboard";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function HoleStatisticsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <HoleAnalyticsDashboard holeId={holeId} />;
}
