import { notFound } from "next/navigation";

import { TrayDetail } from "@/components/trays/tray-detail";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function TrayDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <TrayDetail holeId={holeId} trayId={trayId} />;
}
