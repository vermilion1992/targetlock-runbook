import { notFound } from "next/navigation";

import { ReportCentre } from "@/components/reports/report-centre";
import { isRoutableHoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ReportCentre holeId={holeId} />;
}
