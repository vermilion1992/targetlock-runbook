import { notFound } from "next/navigation";

import { CasingCorrectionForm } from "@/components/casing/casing-correction-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function CorrectCasingPage({
  params,
}: {
  params: Promise<{ holeId: string; casingId: string }>;
}) {
  const { holeId, casingId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <CasingCorrectionForm holeId={holeId} casingId={casingId} />;
}
