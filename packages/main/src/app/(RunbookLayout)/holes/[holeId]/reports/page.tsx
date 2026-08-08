import { notFound } from "next/navigation";

import { ReportCentre } from "@/components/reports/report-centre";
import { isRoutableHoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ shiftId?: string | string[] }>;
}) {
  const { holeId } = await params;
  const query = await searchParams;
  if (!isRoutableHoleId(holeId)) notFound();
  const initialShiftId =
    typeof query.shiftId === "string" ? query.shiftId : undefined;
  return <ReportCentre holeId={holeId} initialShiftId={initialShiftId} />;
}
