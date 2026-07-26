import { notFound } from "next/navigation";

import { TrayCorrectionForm } from "@/components/trays/tray-correction-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function CorrectTrayPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <TrayCorrectionForm holeId={holeId} trayId={trayId} />;
}
