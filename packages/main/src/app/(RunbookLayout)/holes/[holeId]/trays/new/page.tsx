import { notFound } from "next/navigation";

import { TrayForm } from "@/components/trays/tray-form";
import { targetLockStage4Seed } from "@/infrastructure/seed";

export default async function AddTrayPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage4Seed.hole.name) notFound();
  return <TrayForm holeId={holeId} />;
}
