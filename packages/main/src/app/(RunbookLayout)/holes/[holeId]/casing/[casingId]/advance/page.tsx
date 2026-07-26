import { notFound } from "next/navigation";

import { CasingAdvanceForm } from "@/components/casing/casing-advance-form";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function AdvanceCasingPage({
  params,
}: {
  params: Promise<{ holeId: string; casingId: string }>;
}) {
  const { holeId, casingId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <CasingAdvanceForm holeId={holeId} casingId={casingId} />;
}
