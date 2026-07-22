import { notFound } from "next/navigation";

import { ReportCentre } from "@/components/reports/report-centre";
import { isStage5HoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <ReportCentre holeId={holeId} />;
}
