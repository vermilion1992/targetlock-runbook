import { notFound } from "next/navigation";

import { ReportActivity } from "@/components/reports/report-activity";
import { isRoutableHoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReportHistoryPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ReportActivity holeId={holeId} />;
}
