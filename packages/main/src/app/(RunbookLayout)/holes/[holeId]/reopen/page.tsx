import { notFound } from "next/navigation";

import { HoleReopenForm } from "@/components/holes/hole-reopen-form";
import { isStage5HoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReopenHolePage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isStage5HoleId(holeId)) notFound();
  return <HoleReopenForm holeId={holeId} />;
}
