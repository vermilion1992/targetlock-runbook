import { notFound } from "next/navigation";

import { CloseShiftForm } from "@/components/shifts/close-shift-form";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function CloseShiftPage({
  params,
}: {
  params: Promise<{ holeId: string; shiftId: string }>;
}) {
  const { holeId, shiftId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <CloseShiftForm holeId={holeId} shiftId={shiftId} />;
}
