import { notFound } from "next/navigation";

import { ShiftHistory } from "@/components/shifts/shift-history";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <ShiftHistory holeId={holeId} />;
}
