import { notFound } from "next/navigation";

import { TrayLibrary } from "@/components/trays/tray-library";
import { targetLockStage4Seed } from "@/infrastructure/seed";

interface TraysPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function TraysPage({ params }: TraysPageProps) {
  const { holeId } = await params;

  if (holeId !== targetLockStage4Seed.hole.name) {
    notFound();
  }

  return <TrayLibrary holeId={holeId} />;
}
