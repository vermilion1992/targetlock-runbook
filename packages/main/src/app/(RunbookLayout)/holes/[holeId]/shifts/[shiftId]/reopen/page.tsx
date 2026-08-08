import { notFound } from "next/navigation";

import { ReopenShiftForm } from "@/components/shifts/reopen-shift-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function ReopenShiftPage({
  params,
}: {
  params: Promise<{ holeId: string; shiftId: string }>;
}) {
  const { holeId, shiftId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ReopenShiftForm holeId={holeId} shiftId={shiftId} />;
}
