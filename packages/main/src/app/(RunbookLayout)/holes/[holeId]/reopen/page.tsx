import { notFound } from "next/navigation";

import { HoleReopenForm } from "@/components/holes/hole-reopen-form";
import { isRoutableHoleId } from "@/infrastructure/seed/stage5-hole-ids";

export default async function ReopenHolePage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <HoleReopenForm holeId={holeId} />;
}
