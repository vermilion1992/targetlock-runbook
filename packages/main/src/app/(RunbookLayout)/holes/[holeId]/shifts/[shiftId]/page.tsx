import { notFound } from "next/navigation";

import { ShiftDetail } from "@/components/shifts/shift-detail";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; shiftId: string }>;
}) {
  const { holeId, shiftId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <ShiftDetail holeId={holeId} shiftId={shiftId} />;
}
