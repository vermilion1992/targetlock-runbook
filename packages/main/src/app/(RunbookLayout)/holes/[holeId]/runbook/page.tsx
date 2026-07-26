import { notFound } from "next/navigation";

import { RunbookPreview } from "@/components/holes/runbook-preview";
import { isRoutableHoleId } from "@/infrastructure/seed";

interface RunbookPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function RunbookPage({ params }: RunbookPageProps) {
  const { holeId } = await params;

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  return <RunbookPreview holeId={holeId} />;
}
