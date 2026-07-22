import { notFound } from "next/navigation";

import { ShiftHistory } from "@/components/shifts/shift-history";
import { targetLockStage2Seed } from "@/infrastructure/seed";

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage2Seed.hole.name) notFound();
  return <ShiftHistory holeId={holeId} />;
}
