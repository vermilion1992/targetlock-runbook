import { notFound } from "next/navigation";

import { CasingHistory } from "@/components/casing/casing-history";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export default async function CasingHistoryPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage3Seed.hole.name) notFound();
  return <CasingHistory holeId={holeId} />;
}
