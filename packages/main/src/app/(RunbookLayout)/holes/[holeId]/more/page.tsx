import { notFound } from "next/navigation";

import { MorePreview } from "@/components/holes/more-preview";
import { isRoutableHoleId } from "@/infrastructure/seed";

interface MorePageProps {
  params: Promise<{ holeId: string }>;
}

export default async function MorePage({ params }: MorePageProps) {
  const { holeId } = await params;

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  return <MorePreview holeId={holeId} />;
}
