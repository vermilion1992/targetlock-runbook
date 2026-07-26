import { notFound } from "next/navigation";

import { TrayPhotoReplacementForm } from "@/components/trays/tray-photo-replacement-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function ReplaceTrayPhotoPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <TrayPhotoReplacementForm holeId={holeId} trayId={trayId} />;
}
