import { notFound } from "next/navigation";

import { CasingInstallForm } from "@/components/casing/casing-install-form";
import { targetLockStage3Seed } from "@/infrastructure/seed";

export default async function AddCasingPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (holeId !== targetLockStage3Seed.hole.name) notFound();
  return <CasingInstallForm holeId={holeId} />;
}
