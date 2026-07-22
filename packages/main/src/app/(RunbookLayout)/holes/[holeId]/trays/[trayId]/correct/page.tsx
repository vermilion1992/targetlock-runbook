import { notFound } from "next/navigation";

import { TrayCorrectionForm } from "@/components/trays/tray-correction-form";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function CorrectTrayPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <TrayCorrectionForm holeId={holeId} trayId={trayId} />;
}
