import { notFound } from "next/navigation";

import { RecordRunGate } from "@/components/runs/record-run-gate";
import { isRoutableHoleId } from "@/infrastructure/seed";

interface NewRunPageProps {
  params: Promise<{ holeId: string }>;
  searchParams: Promise<{ rod?: string | string[] }>;
}

export default async function NewRunPage({
  params,
  searchParams,
}: NewRunPageProps) {
  const [{ holeId }, query] = await Promise.all([params, searchParams]);

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  const requestedRod = Array.isArray(query.rod) ? query.rod[0] : query.rod;
  const initialRodLength =
    requestedRod === "3" ? 3 : requestedRod === "6" ? 6 : undefined;

  return <RecordRunGate holeId={holeId} initialRodLength={initialRodLength} />;
}
