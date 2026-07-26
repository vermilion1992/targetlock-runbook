import { notFound } from "next/navigation";

import { ShiftDetail } from "@/components/shifts/shift-detail";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; shiftId: string }>;
}) {
  const { holeId, shiftId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ShiftDetail holeId={holeId} shiftId={shiftId} />;
}
