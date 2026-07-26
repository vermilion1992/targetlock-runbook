import { notFound } from "next/navigation";

import { TrayDetail } from "@/components/trays/tray-detail";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function TrayDetailPage({
  params,
}: {
  params: Promise<{ holeId: string; trayId: string }>;
}) {
  const { holeId, trayId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <TrayDetail holeId={holeId} trayId={trayId} />;
}
