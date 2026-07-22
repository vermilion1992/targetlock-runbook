import { notFound } from "next/navigation";

import { TrayPhotoReplacementForm } from "@/components/trays/tray-photo-replacement-form";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function ReplaceTrayPhotoPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <TrayPhotoReplacementForm holeId={holeId} trayId={trayId} />;
}
