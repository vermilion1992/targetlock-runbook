import { notFound } from "next/navigation";

import { ReportActivity } from "@/components/reports/report-activity";
import { isStage5HoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReportHistoryPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <ReportActivity holeId={holeId} />;
}
