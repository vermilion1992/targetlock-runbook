import { notFound } from "next/navigation";

import { CasingHistory } from "@/components/casing/casing-history";
import { isRoutableHoleId } from "@/infrastructure/seed";

export default async function CasingHistoryPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const { holeId } = await params;
  if (!isRoutableHoleId(holeId)) notFound();
  return <CasingHistory holeId={holeId} />;
}
