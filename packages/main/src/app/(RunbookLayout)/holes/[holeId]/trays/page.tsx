import { notFound } from "next/navigation";

import { TrayLibrary } from "@/components/trays/tray-library";
import { isRoutableHoleId } from "@/infrastructure/seed";

interface TraysPageProps {
  params: Promise<{ holeId: string }>;
}

export default async function TraysPage({ params }: TraysPageProps) {
  const { holeId } = await params;

  if (!isRoutableHoleId(holeId)) {
    notFound();
  }

  return <TrayLibrary holeId={holeId} />;
}
